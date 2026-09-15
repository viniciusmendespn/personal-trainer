"""Conexão do personal com o Mercado Pago via OAuth 2.0 + PKCE.

O que estes testes protegem, em ordem de gravidade se quebrar:

1. O `state` é one-shot e tem validade conferida no código — ele é a única prova de
   quem autorizou, já que o callback chega anônimo.
2. O par access/refresh é gravado num put só — o refresh token do MP rotaciona, e
   gravar pela metade perde o acesso à conta do personal para sempre.
3. `REQUER_RECONEXAO` tira a conta do caminho de cobrança e avisa o personal UMA vez.
"""
import urllib.error
import urllib.parse
import time

import pytest

from app.repositories import keys
from app.services import mp_service
from app.utils import pkce_challenge


PERSONAL = "p-1"


@pytest.fixture
def mp_env(monkeypatch, repo_fake):
    from app.config import settings
    monkeypatch.setattr(settings, "mp_client_id", "cli-123")
    monkeypatch.setattr(settings, "mp_client_secret", "sec-456")
    monkeypatch.setattr(settings, "frontend_url", "https://coachpilot.com.br")
    return repo_fake


def _mp_falso(monkeypatch, *, token_resp=None, perfil=None, erro=None):
    """Substitui o transporte HTTP. Guarda as chamadas para inspeção."""
    chamadas = []

    def fake(method, path, token, payload=None, idempotency_key=None):
        chamadas.append({"method": method, "path": path, "token": token,
                         "payload": payload, "idem": idempotency_key})
        if path == "/oauth/token":
            if erro:
                raise erro
            return token_resp or {}
        if path == "/users/me":
            return perfil or {"id": 777, "nickname": "COACH_TESTE", "site_id": "MLB"}
        return {}

    monkeypatch.setattr(mp_service, "_mp_request", fake)
    return chamadas


def _http_error(code, corpo=b'{"error":"invalid_grant"}'):
    import io
    return urllib.error.HTTPError("https://api.mercadopago.com/oauth/token", code,
                                  "erro", {}, io.BytesIO(corpo))


# ── Início da autorização ─────────────────────────────────────────────────────

def test_iniciar_oauth_monta_url_com_pkce_s256(mp_env):
    url = mp_service.iniciar_oauth(PERSONAL)

    assert url.startswith("https://auth.mercadopago.com.br/authorization?"), \
        "host .com.br: o .com genérico abre seletor de país antes do login"
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    assert q["code_challenge_method"] == ["S256"]
    assert q["response_type"] == ["code"]
    assert q["client_id"] == ["cli-123"]
    assert q["redirect_uri"] == ["https://coachpilot.com.br/v1/public/mp/oauth/callback"]

    # O challenge da URL confere com o verifier guardado — é o que o MP vai validar.
    guardado = mp_env.itens[(keys.pk_mp_oauth(q["state"][0]), "META")]
    assert guardado["personal_id"] == PERSONAL
    assert q["code_challenge"] == [pkce_challenge(guardado["code_verifier"])]
    assert guardado["ttl"] > int(time.time())


def test_iniciar_oauth_sem_credenciais_na_stack(monkeypatch, repo_fake):
    from app.config import settings
    monkeypatch.setattr(settings, "mp_client_id", "")
    with pytest.raises(mp_service.OAuthMpError) as exc:
        mp_service.iniciar_oauth(PERSONAL)
    assert exc.value.http == 503


# ── Conclusão ─────────────────────────────────────────────────────────────────

def _state_valido(mp_env):
    url = mp_service.iniciar_oauth(PERSONAL)
    return urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["state"][0]


def test_concluir_oauth_grava_conexao_e_envia_code_verifier(mp_env, monkeypatch):
    state = _state_valido(mp_env)
    verifier = mp_env.itens[(keys.pk_mp_oauth(state), "META")]["code_verifier"]
    chamadas = _mp_falso(monkeypatch, token_resp={
        "access_token": "AT-novo", "refresh_token": "RT-novo",
        "expires_in": 15552000, "user_id": 777,
    })

    assert mp_service.concluir_oauth("code-abc", state) == PERSONAL

    troca = next(c for c in chamadas if c["path"] == "/oauth/token")
    assert troca["payload"]["grant_type"] == "authorization_code"
    assert troca["payload"]["code_verifier"] == verifier
    assert troca["payload"]["client_secret"] == "sec-456"
    assert troca["token"] is None, "/oauth/token não leva Bearer"

    item = mp_env.itens[(keys.pk_personal(PERSONAL), keys.SK_CONFIG_MP)]
    assert item["access_token"] == "AT-novo"
    assert item["refresh_token"] == "RT-novo"
    assert item["status"] == mp_service.STATUS_ATIVO
    assert item["nickname"] == "COACH_TESTE"
    assert item["GSI1PK"].startswith("MP_REFRESH#"), "agendou a renovação preventiva"
    assert mp_service.is_configured(PERSONAL) is True


def test_state_e_one_shot(mp_env, monkeypatch):
    state = _state_valido(mp_env)
    _mp_falso(monkeypatch, token_resp={"access_token": "AT", "refresh_token": "RT",
                                       "user_id": 777})
    mp_service.concluir_oauth("code-abc", state)

    # Um segundo callback com o mesmo state (replay, ou duplo clique) não passa.
    with pytest.raises(mp_service.OAuthMpError) as exc:
        mp_service.concluir_oauth("code-abc", state)
    assert exc.value.codigo == "state_invalido"


def test_state_expirado_e_recusado_mesmo_que_o_ttl_nao_tenha_varrido(mp_env, monkeypatch):
    """O TTL do DynamoDB é best-effort: o item pode continuar lá horas depois."""
    state = _state_valido(mp_env)
    mp_env.itens[(keys.pk_mp_oauth(state), "META")]["ttl"] = int(time.time()) - 1
    _mp_falso(monkeypatch, token_resp={"access_token": "AT"})

    with pytest.raises(mp_service.OAuthMpError) as exc:
        mp_service.concluir_oauth("code-abc", state)
    assert exc.value.codigo == "state_expirado"


def test_state_desconhecido(mp_env, monkeypatch):
    _mp_falso(monkeypatch)
    with pytest.raises(mp_service.OAuthMpError) as exc:
        mp_service.concluir_oauth("code-abc", "nunca-emitido")
    assert exc.value.codigo == "state_invalido"


def test_conta_nao_brasileira_nao_entra(mp_env, monkeypatch):
    state = _state_valido(mp_env)
    _mp_falso(monkeypatch,
              token_resp={"access_token": "AT", "refresh_token": "RT"},
              perfil={"id": 777, "nickname": "X", "site_id": "MLA"})

    with pytest.raises(mp_service.OAuthMpError) as exc:
        mp_service.concluir_oauth("code-abc", state)
    assert exc.value.codigo == "conta_nao_brasileira"
    assert (keys.pk_personal(PERSONAL), keys.SK_CONFIG_MP) not in mp_env.itens


def test_conta_divergente_do_perfil_nao_entra(mp_env, monkeypatch):
    """O token diz ser da conta 999, mas /users/me responde 777."""
    state = _state_valido(mp_env)
    _mp_falso(monkeypatch,
              token_resp={"access_token": "AT", "refresh_token": "RT", "user_id": 999},
              perfil={"id": 777, "nickname": "X", "site_id": "MLB"})

    with pytest.raises(mp_service.OAuthMpError) as exc:
        mp_service.concluir_oauth("code-abc", state)
    assert exc.value.codigo == "oauth_conta_divergente"
    assert (keys.pk_personal(PERSONAL), keys.SK_CONFIG_MP) not in mp_env.itens


# ── Refresh ───────────────────────────────────────────────────────────────────

def _conectado(mp_env, **over):
    item = {
        "access_token": "AT-velho", "refresh_token": "RT-velho",
        "expira_em": "2030-01-01T00:00:00+00:00",
        "status": mp_service.STATUS_ATIVO, "origem": "OAUTH",
        "conectado_em": "2026-01-01T00:00:00+00:00", "mp_user_id": "777",
    }
    item.update(over)
    mp_env.itens[(keys.pk_personal(PERSONAL), keys.SK_CONFIG_MP)] = {
        "PK": keys.pk_personal(PERSONAL), "SK": keys.SK_CONFIG_MP, **item}
    return item


def test_refresh_rotaciona_o_par_e_preserva_conectado_em(mp_env, monkeypatch):
    _conectado(mp_env)
    _mp_falso(monkeypatch, token_resp={
        "access_token": "AT-2", "refresh_token": "RT-2", "expires_in": 15552000,
        "user_id": 777})

    assert mp_service.renovar_token(PERSONAL) is True

    item = mp_env.itens[(keys.pk_personal(PERSONAL), keys.SK_CONFIG_MP)]
    assert (item["access_token"], item["refresh_token"]) == ("AT-2", "RT-2")
    assert item["conectado_em"] == "2026-01-01T00:00:00+00:00", "data original preservada"
    assert item["renovado_em"] is not None


def test_refresh_recusado_marca_reconexao_e_notifica_uma_vez(mp_env, monkeypatch):
    _conectado(mp_env)
    _mp_falso(monkeypatch, erro=_http_error(400, b'{"error":"invalid_grant"}'))
    avisos = []
    monkeypatch.setattr(mp_service, "_avisar_personal", lambda pid: avisos.append(pid))

    assert mp_service.renovar_token(PERSONAL) is False

    item = mp_env.itens[(keys.pk_personal(PERSONAL), keys.SK_CONFIG_MP)]
    assert item["status"] == mp_service.STATUS_RECONEXAO
    assert "access_token" not in item and "refresh_token" not in item, \
        "credencial morta não fica guardada"
    assert "GSI1PK" not in item, "saiu do índice de renovação"
    assert avisos == [PERSONAL]

    # Segunda marcação (ex.: outra cobrança falhando) não gera segundo aviso.
    assert mp_service.marcar_reconexao(PERSONAL, "de_novo") is False
    assert avisos == [PERSONAL]


def test_reconexao_tira_do_caminho_de_cobranca(mp_env):
    _conectado(mp_env, status=mp_service.STATUS_RECONEXAO)
    assert mp_service.is_configured(PERSONAL) is False
    assert mp_service.status_conexao(PERSONAL)["configurado"] is False


def test_falha_transitoria_nao_derruba_a_conexao(mp_env, monkeypatch):
    _conectado(mp_env)
    _mp_falso(monkeypatch, erro=_http_error(500, b'{"message":"oops"}'))

    assert mp_service.renovar_token(PERSONAL) is False

    item = mp_env.itens[(keys.pk_personal(PERSONAL), keys.SK_CONFIG_MP)]
    assert item["status"] == mp_service.STATUS_ATIVO, "MP fora do ar não é revogação"
    assert item["access_token"] == "AT-velho"
    assert item["refresh_tentativas"] == 1
    assert item["GSI1PK"].startswith("MP_REFRESH#"), "reagendou para retentar"


def test_token_vencido_com_erro_transitorio_vira_reconexao(mp_env, monkeypatch):
    """Vencido + MP instável: não adianta esperar, a credencial já não serve."""
    _conectado(mp_env, expira_em="2020-01-01T00:00:00+00:00")
    _mp_falso(monkeypatch, erro=_http_error(500))
    monkeypatch.setattr(mp_service, "_avisar_personal", lambda pid: None)

    assert mp_service.renovar_token(PERSONAL) is False
    item = mp_env.itens[(keys.pk_personal(PERSONAL), keys.SK_CONFIG_MP)]
    assert item["status"] == mp_service.STATUS_RECONEXAO


def test_sem_credenciais_o_job_nao_toca_no_indice(mp_env, monkeypatch):
    from app.config import settings
    _conectado(mp_env, GSI1PK=keys.gsi1_mp_refresh_pk("2026-09-15"))
    monkeypatch.setattr(settings, "mp_client_id", "")
    chamadas = _mp_falso(monkeypatch)

    assert mp_service.renovar_vencendo() == 0
    assert chamadas == [], "não tentou renovar nada"
    item = mp_env.itens[(keys.pk_personal(PERSONAL), keys.SK_CONFIG_MP)]
    assert item["GSI1PK"] == keys.gsi1_mp_refresh_pk("2026-09-15"), "agendamento intacto"


# ── Desconexão e status ───────────────────────────────────────────────────────

def test_status_nunca_devolve_credencial(mp_env):
    _conectado(mp_env, nickname="COACH_TESTE")
    resposta = mp_service.status_conexao(PERSONAL)
    assert resposta["configurado"] is True
    assert resposta["apelido"] == "COACH_TESTE"
    assert "access_token" not in resposta
    assert "refresh_token" not in resposta


def test_desconectar_apaga_a_conexao(mp_env):
    _conectado(mp_env)
    mp_service.desconectar(PERSONAL)
    assert mp_service.is_configured(PERSONAL) is False
    assert mp_service.status_conexao(PERSONAL) == {
        "configurado": False, "oauth_disponivel": True}
