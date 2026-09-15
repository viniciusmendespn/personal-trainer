"""Integração Mercado Pago — conexão OAuth do personal, PIX QR Code e webhook.

Sem SDK; chamadas via urllib.request. Tokens ficam em DynamoDB
(PT#{personal_id}/CONFIG#MERCADOPAGO), nunca logados, nunca retornados ao frontend.

Conexão (OAuth 2.0 + PKCE — o personal clica uma vez, não cola token):
  1. iniciar_oauth  → grava state+code_verifier (TTL 10 min) e devolve a URL do MP
  2. o personal autoriza em auth.mercadopago.com.br
  3. concluir_oauth → consome o state (one-shot), troca o code por access+refresh,
     confere a conta em /users/me e grava
  4. renovar_token  → refresh preventivo (cron, 30 dias antes) e reativo (401)

Fluxo criar_pix:
  1. Lê token válido (renovando se estiver vencendo) de PT#{personal_id}/CONFIG#MERCADOPAGO
  2. Chama POST /v1/payments com payment_method_id=pix
  3. Salva routing (MP_LOCK#{payment_id}/routing) para que o webhook resolva personal_id
  4. Retorna {payment_id, qr_code, qr_code_base64, expires_at}

Fluxo processar_webhook:
  1. Idempotência: busca MP_LOCK#{payment_id}/lock — aborta se já processado
  2. Busca MP_LOCK#{payment_id}/routing para obter personal_id/aluno_id/cobranca_id
  3. Re-consulta pagamento real no MP (nunca confiar no payload do webhook)
  4. Confirma status=approved + valida external_reference
  5. Grava lock com TTL 60 dias
  6. Chama financeiro_service.registrar_pagamento + atualiza campos MP + notifica aluno
"""
import json
import logging
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta

from app.config import settings
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import de_iso, now, now_iso, pkce_challenge, ttl_em

logger = logging.getLogger(__name__)

_MP_BASE = "https://api.mercadopago.com"
#: Host brasileiro de propósito: o `auth.mercadopago.com` genérico da doc abre um
#: seletor de país antes do login — um passo a mais para o personal.
_AUTH_URL = "https://auth.mercadopago.com.br/authorization"
_LOCK_TTL_S = 60 * 24 * 3600    # 60 dias — idempotência webhook
_ROUTING_TTL_S = 25 * 3600      # 25 horas — lookup payment_id → personal_id
_OAUTH_STATE_TTL_MIN = 10       # janela para o personal autorizar no MP

STATUS_ATIVO = "ATIVO"
STATUS_RECONEXAO = "REQUER_RECONEXAO"
ORIGEM_OAUTH = "OAUTH"

#: Validade padrão do token do MP quando a resposta não trouxer `expires_in` (180 dias).
_EXPIRES_IN_PADRAO_S = 15552000
#: Renovação preventiva: agendada no GSI1 para `expira_em - 30 dias`. Com 180 dias de
#: validade, a primeira cai 150 dias depois de conectar.
_DIAS_ANTES_REFRESH = 30
#: Falha transitória reagenda para hoje+2 — o scheduler roda de HORA em hora e varre
#: ontem/hoje/amanhã; "+1" faria ele retentar na hora seguinte.
_DIAS_RETENTATIVA = 2
#: Token vencendo em menos disso é renovado ANTES da cobrança.
_MARGEM_REFRESH_COBRANCA = timedelta(days=1)
#: Erros do `/oauth/token` que significam "esta autorização morreu" — reconexão, não retry.
_ERROS_DEFINITIVOS = {"invalid_grant", "invalid_token", "invalid_client", "unauthorized_client"}


# ── Credencial do personal ─────────────────────────────────────────────────────

def obter_conexao(personal_id: str) -> dict | None:
    return repo.get_item(keys.pk_personal(personal_id), keys.SK_CONFIG_MP)


def _ativa(item: dict | None) -> bool:
    """Pode cobrar agora? Um item em REQUER_RECONEXAO existe mas não cobra."""
    return bool(item) and item.get("status") != STATUS_RECONEXAO and bool(item.get("access_token"))


def is_configured(personal_id: str) -> bool:
    """"Esse personal consegue cobrar por Pix agora?" — é o que decide se o botão
    aparece para o aluno (aluno.py), no resumo financeiro e na loja. REQUER_RECONEXAO
    responde False, então quem precisa reconectar some do caminho de cobrança sozinho."""
    item = repo.get_item(keys.pk_personal(personal_id), keys.SK_CONFIG_MP)
    return _ativa(item)


def oauth_disponivel() -> bool:
    """Sem as credenciais da aplicação na stack não há o que conectar — a tela mostra
    "indisponível" em vez de um botão que erraria."""
    return bool(settings.mp_client_id and settings.mp_client_secret and settings.frontend_url)


def _get_token(personal_id: str) -> str | None:
    """Token válido para o hot path: renova antes se estiver a menos de 1 dia de vencer.

    ⚠️ Porta ÚNICA de entrada do token neste módulo — é por isso que criar_pix, a loja,
    a consulta de status e o webhook herdam o refresh sem nenhum código próprio.
    """
    item = obter_conexao(personal_id)
    if not _ativa(item):
        return None
    if item.get("expira_em") and de_iso(item["expira_em"]) <= now() + _MARGEM_REFRESH_COBRANCA:
        if renovar_token(personal_id):
            item = obter_conexao(personal_id)
    return item.get("access_token") if _ativa(item) else None


def status_conexao(personal_id: str) -> dict:
    """⚠️ Nunca devolve token nem refresh_token — só o que a UI precisa mostrar."""
    item = obter_conexao(personal_id)
    if not item:
        return {"configurado": False, "oauth_disponivel": oauth_disponivel()}
    return {
        "configurado": _ativa(item),
        "status": item.get("status") or STATUS_ATIVO,
        "apelido": item.get("nickname"),
        "conectado_em": item.get("conectado_em"),
        "renovado_em": item.get("renovado_em"),
        "expira_em": item.get("expira_em"),
        "reconexao_em": item.get("reconexao_em"),
        "oauth_disponivel": oauth_disponivel(),
    }


def desconectar(personal_id: str) -> None:
    """Apaga a conexão local. NÃO revoga no Mercado Pago — a UI diz que o personal
    pode revogar também pelo painel de aplicações conectadas dele."""
    repo.delete_item(keys.pk_personal(personal_id), keys.SK_CONFIG_MP)


# ── HTTP helpers ───────────────────────────────────────────────────────────────

def _mp_request(method: str, path: str, token: str | None,
                payload: dict | None = None,
                idempotency_key: str | None = None) -> dict:
    """`token=None` para os endpoints sem Bearer (`/oauth/token`)."""
    data = json.dumps(payload).encode() if payload else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    req = urllib.request.Request(
        f"{_MP_BASE}{path}", data=data, headers=headers, method=method,
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read() or b"{}")


def _request_personal(personal_id: str, method: str, path: str,
                      payload: dict | None = None,
                      idempotency_key: str | None = None,
                      rotulo: str = "mp") -> dict:
    """Chamada com o token do PERSONAL, com refresh reativo.

    Em 401: um refresh, um retry com a MESMA `X-Idempotency-Key` (reusar a chave é o
    que impede o MP criar uma segunda cobrança no retry). Se ainda der 401, a conexão
    está morta — marca reconexão e avisa o personal.
    """
    token = _get_token(personal_id)
    if not token:
        raise ValueError("Mercado Pago não configurado para este personal.")
    try:
        return _mp_request(method, path, token, payload, idempotency_key=idempotency_key)
    except urllib.error.HTTPError as exc:
        if exc.code != 401:
            body = exc.read().decode(errors="ignore")
            logger.error("MP %s HTTP %s: %s", rotulo, exc.code, body)
            raise ValueError(f"Erro Mercado Pago: {exc.code}")

    if renovar_token(personal_id):
        token = _get_token(personal_id)
        if token:
            try:
                return _mp_request(method, path, token, payload, idempotency_key=idempotency_key)
            except urllib.error.HTTPError as exc:
                if exc.code != 401:
                    body = exc.read().decode(errors="ignore")
                    logger.error("MP %s HTTP %s (pós-refresh): %s", rotulo, exc.code, body)
                    raise ValueError(f"Erro Mercado Pago: {exc.code}")
    marcar_reconexao(personal_id, "401_na_cobranca")
    raise ValueError("Mercado Pago não configurado para este personal.")


# ── OAuth: "Conectar com Mercado Pago" ─────────────────────────────────────────

class OAuthMpError(Exception):
    """`http` é o status que NÓS devolvemos; `status_mp`/`erro_mp` é o que o Mercado Pago
    respondeu (`None` em timeout/rede). É o que separa "autorização revogada" (400,
    `invalid_grant`) de "MP fora do ar" — o primeiro exige reconexão, o segundo não."""

    def __init__(self, codigo: str, mensagem: str, http: int = 502,
                 status_mp: int | None = None, erro_mp: str | None = None):
        self.codigo = codigo
        self.http = http
        self.status_mp = status_mp
        self.erro_mp = erro_mp
        super().__init__(mensagem)

    @property
    def transitoria(self) -> bool:
        return self.status_mp is None or self.status_mp >= 500 or self.status_mp == 429


def redirect_uri() -> str:
    """⚠️ Tem que bater CARACTERE a caractere com a Redirect URL cadastrada na aplicação
    do painel do MP — ela vai na autorização E de novo na troca do code.

    Passa pelo CloudFront (behavior `/v1/*` → API Gateway) e cai na rota `PublicProxy`,
    que é `Authorizer: NONE`: quem volta do MP não carrega o JWT do Cognito.
    """
    return f"{settings.frontend_url.rstrip('/')}/v1/public/mp/oauth/callback"


def _oauth_token(payload: dict) -> dict:
    """POST /oauth/token. ⚠️ Vai em JSON, como a doc vigente do MP pede — não
    `application/x-www-form-urlencoded`."""
    corpo = {"client_id": settings.mp_client_id,
             "client_secret": settings.mp_client_secret, **payload}
    try:
        return _mp_request("POST", "/oauth/token", None, corpo)
    except urllib.error.HTTPError as exc:
        texto = exc.read().decode(errors="ignore")[:400]
        # ⚠️ Loga o código e o corpo da RESPOSTA — nunca o payload enviado (tem o secret)
        logger.error("[mp-oauth] /oauth/token -> HTTP %s: %s", exc.code, texto)
        erro = None
        try:
            erro = (json.loads(texto) or {}).get("error")
        except ValueError:
            pass
        raise OAuthMpError("mercadopago_erro", f"Mercado Pago respondeu {exc.code}.",
                           status_mp=exc.code, erro_mp=str(erro) if erro else None)
    except Exception as exc:
        logger.error("[mp-oauth] /oauth/token falhou: %s", exc)
        raise OAuthMpError("mercadopago_indisponivel", "Mercado Pago indisponível.")


def _perfil_mp(token: str) -> dict:
    """`GET /users/me`: confirma que a conta é brasileira e devolve a identidade dela."""
    try:
        dados = _mp_request("GET", "/users/me", token)
    except urllib.error.HTTPError as exc:
        logger.error("[mp-oauth] /users/me -> HTTP %s", exc.code)
        raise OAuthMpError("perfil_indisponivel", "Não foi possível ler a conta.",
                           status_mp=exc.code)
    if dados.get("site_id") != "MLB":
        raise OAuthMpError(
            "conta_nao_brasileira",
            "Essa conta do Mercado Pago não é do Brasil — o Pix não fica disponível.",
            http=422)
    return {"mp_user_id": str(dados.get("id")), "nickname": dados.get("nickname")}


def iniciar_oauth(personal_id: str) -> str:
    """Grava `state` + `code_verifier` (TTL 10 min) e devolve a URL de autorização."""
    if not oauth_disponivel():
        raise OAuthMpError("oauth_indisponivel",
                           "A conexão com o Mercado Pago está temporariamente indisponível.",
                           http=503)
    state = secrets.token_urlsafe(24)
    verifier = secrets.token_urlsafe(64)
    repo.put_item(keys.pk_mp_oauth(state), "META", {
        "personal_id": personal_id,
        "code_verifier": verifier,
        "ttl": ttl_em(minutos=_OAUTH_STATE_TTL_MIN),
    })
    query = urllib.parse.urlencode({
        "client_id": settings.mp_client_id,
        "response_type": "code",
        "platform_id": "mp",
        "state": state,
        "redirect_uri": redirect_uri(),
        "code_challenge": pkce_challenge(verifier),
        "code_challenge_method": "S256",
    })
    return f"{_AUTH_URL}?{query}"


def concluir_oauth(code: str, state: str) -> str:
    """Consome o `state` atomicamente (one-shot) e troca o `code` por tokens.
    Devolve o `personal_id` que autorizou."""
    ref = repo.delete_item_if_exists(keys.pk_mp_oauth(state), "META", retornar=True)
    if not ref:
        raise OAuthMpError("state_invalido", "Sessão de conexão expirada. Tente de novo.",
                           http=400)
    # ⚠️ TTL do DynamoDB é best-effort (pode levar horas para varrer): a validade é
    # conferida aqui, senão um state antigo continuaria aceito.
    if int(ref.get("ttl") or 0) <= int(time.time()):
        raise OAuthMpError("state_expirado", "Sessão de conexão expirada. Tente de novo.",
                           http=400)
    dados = _oauth_token({
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri(),
        "code_verifier": ref.get("code_verifier") or "",
    })
    personal_id = ref["personal_id"]
    _gravar_oauth(personal_id, dados)
    return personal_id


def _chaves_refresh(expira_em: str, personal_id: str) -> dict:
    dia = (de_iso(expira_em) - timedelta(days=_DIAS_ANTES_REFRESH)).strftime("%Y-%m-%d")
    return {
        "GSI1PK": keys.gsi1_mp_refresh_pk(dia),
        "GSI1SK": keys.gsi1_mp_refresh_sk(dia, personal_id),
    }


def _gravar_oauth(personal_id: str, dados: dict, anterior: dict | None = None) -> None:
    """**Único** escritor do item de conexão, com um put_item do item INTEIRO.

    ⚠️ O refresh token do MP rotaciona: a cada renovação vem um par novo e o antigo
    morre. Gravar em dois updates separados é o que separa "renovado" de "perdemos o
    acesso à conta do personal para sempre".

    Valida `oauth.user_id == /users/me.id` e `site_id == "MLB"` ANTES de persistir: um
    token que diz ser de uma conta e responde outra não entra.
    """
    access = dados.get("access_token")
    if not access:
        raise OAuthMpError("oauth_sem_token", "O Mercado Pago não devolveu o token.")
    expira = (now() + timedelta(
        seconds=int(dados.get("expires_in") or _EXPIRES_IN_PADRAO_S))).isoformat()
    info = _perfil_mp(access)
    user_id_oauth = str(dados.get("user_id") or "")
    if user_id_oauth and user_id_oauth != info["mp_user_id"]:
        raise OAuthMpError("oauth_conta_divergente",
                           "A conta autorizada não confere. Tente de novo.")
    refresh = dados.get("refresh_token") or (anterior or {}).get("refresh_token")
    item = {
        "access_token": access,
        "refresh_token": refresh,
        "expira_em": expira,
        "mp_user_id": info["mp_user_id"],
        "nickname": info["nickname"],
        "status": STATUS_ATIVO,
        "origem": ORIGEM_OAUTH,
        "conectado_em": (anterior or {}).get("conectado_em") or now_iso(),
        "renovado_em": now_iso() if anterior else None,
        "configurado_em": now_iso(),   # compat: o campo que a tela antiga já lia
        "refresh_tentativas": 0,
        "refresh_erro": None,
    }
    if refresh:
        item.update(_chaves_refresh(expira, personal_id))
    repo.put_item(keys.pk_personal(personal_id), keys.SK_CONFIG_MP, item)


def marcar_reconexao(personal_id: str, motivo: str) -> bool:
    """Refresh recusado ou 401 na cobrança: a conta sai do caminho de cobrança (o botão
    Pix some para os alunos), a identidade fica guardada para a UI mostrar "Reconectar"
    e o personal é avisado UMA vez.

    A condição `status ausente OU ATIVO` é o que impede a segunda notificação — e o
    "ausente" é o que faz a transição valer também para o item legado (token colado).
    True = foi esta chamada que fez a transição.
    """
    item = repo.update_item_if(
        keys.pk_personal(personal_id), keys.SK_CONFIG_MP,
        "attribute_not_exists(#c_st) OR #c_st = :c_ativo",
        {"status": STATUS_RECONEXAO, "reconexao_motivo": motivo[:120],
         "reconexao_em": now_iso()},
        nomes_condicao={"#c_st": "status"},
        valores_condicao={":c_ativo": STATUS_ATIVO},
        remover=["access_token", "refresh_token", "GSI1PK", "GSI1SK"],
    )
    if item is None:
        return False
    logger.warning("[mp] conexão requer reconexão personal=%s motivo=%s", personal_id, motivo)
    _avisar_personal(personal_id)
    return True


def _avisar_personal(personal_id: str) -> None:
    """Notificação no feed + push. Best-effort: o aviso nunca derruba a cobrança nem o job."""
    from app.services import notif_service
    try:
        notif_service.criar(
            personal_id, "MP_RECONECTAR", "Reconecte seu Mercado Pago",
            "A conexão com o Mercado Pago expirou ou foi revogada. Enquanto isso, seus "
            "alunos não conseguem pagar por Pix. Reconecte em Configurações → Pagamentos.")
    except Exception as exc:
        logger.error("[mp] aviso de reconexão falhou personal=%s: %s", personal_id, exc)


def renovar_token(personal_id: str) -> bool:
    """Renovação preventiva (scheduler, 30 dias antes) e reativa (401 na cobrança).

    Transitória → reagenda e conta a tentativa; definitiva (refresh recusado, sem
    refresh token, ou já vencido) → REQUER_RECONEXAO.
    """
    item = obter_conexao(personal_id)
    if not _ativa(item):
        return False
    if not item.get("refresh_token"):
        # Item legado (token colado à mão) só chega aqui por um 401 real na cobrança —
        # nunca pelo cron (não está no índice) nem pela margem (não tem `expira_em`).
        marcar_reconexao(personal_id, "sem_refresh_token")
        return False
    try:
        dados = _oauth_token({"grant_type": "refresh_token",
                              "refresh_token": item["refresh_token"]})
        _gravar_oauth(personal_id, dados, anterior=item)
        return True
    except OAuthMpError as exc:
        vencido = bool(item.get("expira_em")) and de_iso(item["expira_em"]) <= now()
        definitiva = (exc.erro_mp in _ERROS_DEFINITIVOS) or (not exc.transitoria) or vencido
        logger.error("[mp] refresh falhou personal=%s (%s, mp=%s/%s, definitiva=%s)",
                     personal_id, exc.codigo, exc.status_mp, exc.erro_mp, definitiva)
        if definitiva:
            marcar_reconexao(personal_id, f"refresh:{exc.erro_mp or exc.status_mp or exc.codigo}")
            return False
        dia = (now() + timedelta(days=_DIAS_RETENTATIVA)).strftime("%Y-%m-%d")
        repo.add_and_set(
            keys.pk_personal(personal_id), keys.SK_CONFIG_MP,
            add={"refresh_tentativas": 1},
            set_={"refresh_erro": f"{exc.status_mp or exc.codigo}"[:60],
                  "GSI1PK": keys.gsi1_mp_refresh_pk(dia),
                  "GSI1SK": keys.gsi1_mp_refresh_sk(dia, personal_id)},
            if_exists=True,
        )
        return False


def renovar_vencendo(dias: tuple[int, ...] = (-1, 0, 1)) -> int:
    """Varre os buckets de renovação do GSI1 e renova o que está agendado. Chamado pelo
    scheduler horário. Devolve quantas conexões foram renovadas com sucesso."""
    if not oauth_disponivel():
        # ⚠️ Desiste ANTES de tocar no índice: sem credenciais toda renovação falharia
        # e reagendaria os itens, embaralhando o agendamento de todo mundo.
        logger.info("[mp-refresh] OAuth não configurado — agendamentos preservados")
        return 0
    n = 0
    for delta in dias:
        dia = (now() + timedelta(days=delta)).strftime("%Y-%m-%d")
        cursor = None
        while True:
            items, cursor = repo.query_gsi1_page(keys.gsi1_mp_refresh_pk(dia), limit=50,
                                                 cursor=cursor)
            for it in items:
                personal_id = str(it.get("PK", "")).removeprefix("PT#")
                if personal_id and renovar_token(personal_id):
                    n += 1
            if cursor is None:
                break
    if n:
        logger.info("[mp-refresh] %s conexão(ões) renovada(s)", n)
    return n


# ── Criar PIX ──────────────────────────────────────────────────────────────────

def criar_pix(personal_id: str, aluno: dict, cobranca: dict) -> dict:
    """Cria pagamento PIX e retorna {payment_id, qr_code, qr_code_base64, expires_at}."""
    cobranca_id = cobranca["cobranca_id"]
    aluno_id = cobranca["aluno_id"]
    external_reference = f"COBRANCA|{personal_id}|{aluno_id}|{cobranca_id}"

    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).strftime(
        "%Y-%m-%dT%H:%M:%S.000+00:00"
    )
    nome_partes = (aluno.get("nome") or "Aluno Cliente").split()
    first_name = nome_partes[0]
    last_name = " ".join(nome_partes[1:]) if len(nome_partes) > 1 else "Cliente"

    payload = {
        "transaction_amount": float(cobranca["valor"]),
        "payment_method_id": "pix",
        "payer": {
            "email": aluno.get("email") or f"aluno_{aluno_id[:8]}@personal.app",
            "first_name": first_name,
            "last_name": last_name,
        },
        "description": "Mensalidade Personal Trainer",
        "external_reference": external_reference,
        "date_of_expiration": expires_at,
    }
    if settings.webhook_base_url:
        payload["notification_url"] = f"{settings.webhook_base_url}/v1/public/mp/webhook"
    resp = _request_personal(personal_id, "POST", "/v1/payments", payload,
                             idempotency_key=cobranca_id, rotulo="criar_pix")

    payment_id = str(resp["id"])
    pix_data = resp.get("point_of_interaction", {}).get("transaction_data", {})

    # Salva routing payment_id → personal/aluno/cobrança (para o webhook resolver)
    lock_pk = keys.pk_mp_lock(payment_id)
    repo.put_item(lock_pk, "routing", {
        "personal_id": personal_id,
        "aluno_id": aluno_id,
        "cobranca_id": cobranca_id,
        "ttl": int(time.time()) + _ROUTING_TTL_S,
    })

    # Salva mp_payment_id na cobrança para exibição futura
    idx = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_cobranca_idx(cobranca_id))
    if idx and idx.get("sk"):
        repo.update_item_if_exists(keys.pk_aluno(aluno_id), idx["sk"], {
            "mp_payment_id": payment_id,
            "atualizado_em": now_iso(),
        })

    return {
        "payment_id": payment_id,
        "qr_code": pix_data.get("qr_code"),
        "qr_code_base64": pix_data.get("qr_code_base64"),
        "expires_at": expires_at,
    }


# ── Líquido / taxa real do pagamento ────────────────────────────────────────────

def extrair_liquido_taxa(resp: dict, valor_total: float) -> tuple[float | None, float | None]:
    """Extrai (valor_liquido, taxa_real) da resposta do MP — só quando há certeza.

    `net_received_amount` vive dentro de `transaction_details` (NÃO no topo do JSON);
    ler no topo devolvia sempre None e zerava a taxa em todo Pix. Se o net não vier,
    soma os `fee_details` do collector como 2ª fonte. Se nada disso existir, devolve
    (None, None) — sinal explícito de "taxa desconhecida". Nunca finge líquido = bruto,
    para não passar ao personal a impressão de que recebeu o valor cheio.
    """
    td = resp.get("transaction_details") or {}
    net = td.get("net_received_amount")
    if net is None:
        fees = resp.get("fee_details") or []
        if fees:
            taxa_mp = sum(float(f.get("amount", 0) or 0) for f in fees
                          if f.get("fee_payer") == "collector")
            net = valor_total - taxa_mp
    if net is None:
        return None, None
    net = float(net)
    return net, round(valor_total - net, 4)


# ── Status do pagamento ────────────────────────────────────────────────────────

def get_payment_status(personal_id: str, payment_id: str) -> dict:
    """Re-consulta status real no MP. Retorna {payment_id, status, valor_liquido, taxa}."""
    resp = _request_personal(personal_id, "GET", f"/v1/payments/{payment_id}",
                             rotulo="get_status")

    valor_total = float(resp.get("transaction_amount", 0))
    valor_liquido, taxa = extrair_liquido_taxa(resp, valor_total)
    return {
        "payment_id": payment_id,
        "status": resp.get("status"),   # approved | pending | rejected | cancelled
        # Endpoint de polling/status — quando a taxa ainda não veio do MP, devolve o
        # bruto (aqui não precisa de precisão; o líquido oficial é apurado no webhook).
        "valor_liquido": valor_liquido if valor_liquido is not None else valor_total,
        "taxa": taxa if taxa is not None else 0.0,
        "external_reference": resp.get("external_reference"),
    }


# ── Loja (marketplace de pacotes) ─────────────────────────────────────────────

def criar_pix_loja(vendedor_id: str, comprador_id: str, comprador_nome: str,
                   pedido: dict) -> dict:
    """PIX de venda de pacote na loja — pagamento cai na conta MP do VENDEDOR.
    external_reference LOJA|... roteia o webhook para loja_service."""
    pedido_id = pedido["pedido_id"]
    external_reference = f"LOJA|{vendedor_id}|{comprador_id}|{pedido_id}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).strftime(
        "%Y-%m-%dT%H:%M:%S.000+00:00"
    )
    nome_partes = (comprador_nome or "Personal Comprador").split()
    payload = {
        "transaction_amount": round(pedido["preco_centavos"] / 100, 2),
        "payment_method_id": "pix",
        "payer": {
            "email": f"comprador_{comprador_id[:8]}@coachpilot.app",
            "first_name": nome_partes[0],
            "last_name": " ".join(nome_partes[1:]) or "Comprador",
        },
        "description": f"CoachPilot Loja — {pedido['titulo']}"[:250],
        "external_reference": external_reference,
        "date_of_expiration": expires_at,
    }
    if settings.webhook_base_url:
        payload["notification_url"] = f"{settings.webhook_base_url}/v1/public/mp/webhook"
    resp = _request_personal(vendedor_id, "POST", "/v1/payments", payload,
                             idempotency_key=pedido_id, rotulo="criar_pix_loja")

    payment_id = str(resp["id"])
    pix_data = resp.get("point_of_interaction", {}).get("transaction_data", {})

    # Routing payment_id → pedido da loja (o webhook resolve por aqui; tipo=LOJA despacha)
    repo.put_item(keys.pk_mp_lock(payment_id), "routing", {
        "tipo": "LOJA",
        "vendedor_id": vendedor_id,
        "comprador_id": comprador_id,
        "pedido_id": pedido_id,
        "ttl": int(time.time()) + _ROUTING_TTL_S,
    })

    return {
        "payment_id": payment_id,
        "qr_code": pix_data.get("qr_code"),
        "qr_code_base64": pix_data.get("qr_code_base64"),
        "expires_at": expires_at,
    }


def consultar_pix(personal_id: str, payment_id: str) -> dict:
    """Re-obtém os dados do PIX (QR) de um pagamento existente — o checkout não
    persiste o QR no Dynamo (item pequeno); ao reabrir, busca no MP."""
    resp = _request_personal(personal_id, "GET", f"/v1/payments/{payment_id}",
                             rotulo="consultar_pix")
    pix_data = resp.get("point_of_interaction", {}).get("transaction_data", {})
    return {
        "payment_id": payment_id,
        "status": resp.get("status"),
        "qr_code": pix_data.get("qr_code"),
        "qr_code_base64": pix_data.get("qr_code_base64"),
        "expires_at": resp.get("date_of_expiration"),
    }


# ── Processar webhook ─────────────────────────────────────────────────────────

def processar_webhook(body: dict) -> None:
    """Processa notificação do MP com idempotência via MP_LOCK#/{lock,routing}."""
    action = body.get("action", "")
    if action not in ("payment.created", "payment.updated"):
        return

    payment_id = str(body.get("data", {}).get("id", ""))
    if not payment_id:
        return

    lock_pk = keys.pk_mp_lock(payment_id)

    # ── Idempotência ──────────────────────────────────────────────────────────
    if repo.get_item(lock_pk, "lock"):
        logger.info("MP webhook duplicado payment_id=%s — ignorado", payment_id)
        return

    # ── Routing: resolve personal_id/aluno_id/cobranca_id ────────────────────
    routing = repo.get_item(lock_pk, "routing")
    if not routing:
        logger.warning("MP webhook sem routing payment_id=%s — descartado", payment_id)
        return

    # Ramo LOJA (marketplace de pacotes): routing próprio, entrega delegada.
    if routing.get("tipo") == "LOJA":
        from app.services import loja_service   # import tardio — evita ciclo
        loja_service.processar_pagamento_loja(payment_id, routing)
        return

    personal_id = routing.get("personal_id")
    aluno_id = routing.get("aluno_id")
    cobranca_id = routing.get("cobranca_id")
    if not all([personal_id, aluno_id, cobranca_id]):
        return

    # ── Re-consulta real (nunca confiar no payload do webhook) ────────────────
    # Sem token válido, sai sem gravar lock: o MP reenvia, e se o personal reconectar
    # nesse meio tempo o pagamento ainda é baixado.
    try:
        resp = _request_personal(personal_id, "GET", f"/v1/payments/{payment_id}",
                                 rotulo="re-query")
    except Exception as exc:
        logger.error("MP re-query falhou payment_id=%s: %s", payment_id, exc)
        return

    if resp.get("status") != "approved":
        return   # aguarda próximo webhook quando status mudar

    # ── Valida external_reference ─────────────────────────────────────────────
    ext_ref = resp.get("external_reference", "")
    parts = ext_ref.split("|")
    if len(parts) != 4 or parts[0] != "COBRANCA":
        logger.warning("MP external_reference inválido: %s", ext_ref)
        return
    _, ref_personal_id, ref_aluno_id, ref_cobranca_id = parts
    if ref_personal_id != personal_id or ref_aluno_id != aluno_id or ref_cobranca_id != cobranca_id:
        logger.warning("MP mismatch ext_ref=%s routing=%s/%s/%s",
                       ext_ref, personal_id, aluno_id, cobranca_id)
        return

    # ── Grava lock ANTES de processar (evita race-condition em reinvocações) ──
    repo.put_item(lock_pk, "lock", {
        "payment_id": payment_id,
        "processado_em": now_iso(),
        "ttl": int(time.time()) + _LOCK_TTL_S,
    })

    valor_total = float(resp.get("transaction_amount", 0))
    # None quando o MP ainda não informou o líquido — o painel trata como taxa
    # desconhecida (mês fica "incerto") em vez de assumir que recebeu o valor cheio.
    valor_liquido, taxa = extrair_liquido_taxa(resp, valor_total)
    if taxa is None:
        logger.warning("MP sem net/fee_details payment_id=%s — taxa desconhecida", payment_id)

    # ── Registra pagamento (valor líquido/taxa entram no agregado do painel) ──
    from app.services import financeiro_service
    result = financeiro_service.registrar_pagamento(
        personal_id, aluno_id, cobranca_id,
        {"data_pagamento": now_iso()[:10], "forma_pagamento": "PIX_MP", "notas": None,
         "mp_valor_liquido": valor_liquido, "mp_taxa": taxa},
    )

    if result:
        # mp_payment_id não trafega pelo body do registrar_pagamento — grava aqui.
        idx = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_cobranca_idx(cobranca_id))
        if idx and idx.get("sk"):
            repo.update_item_if_exists(keys.pk_aluno(aluno_id), idx["sk"], {
                "mp_payment_id": payment_id,
            })
        # Notifica aluno
        from app.services import anotif_service
        anotif_service.criar(
            aluno_id, "COBRANCA_PAGA",
            "Pagamento confirmado",
            f"Seu pagamento de R$ {valor_total:.2f} foi confirmado via Pix.",
        )

    logger.info("MP webhook processado payment_id=%s cobranca_id=%s", payment_id, cobranca_id)
