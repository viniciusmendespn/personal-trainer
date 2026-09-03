"""Requisitos da submissão de app do ChatGPT.

Cada teste aqui existe por causa de uma exigência explícita da OpenAI em
developers.openai.com/plugins/deploy/submission. São critérios de review — quebrar um
significa reprovar a submissão, o que nenhum teste funcional pegaria.
"""
import pytest
from fastapi.testclient import TestClient

from app.mcp import tokens as mcp_tokens
from app.mcp.asgi import app
from app.repositories import keys

PERSONAL = "personal-1"
CONN = "conn-1"


@pytest.fixture
def cliente(mcp_env):
    mcp_env.put_item(keys.pk_personal(PERSONAL), keys.sk_mcp_conn(CONN), {
        "conn_id": CONN, "client_name": "ChatGPT", "email": "personal@exemplo.test",
        "scopes": [mcp_tokens.SCOPE_READ, mcp_tokens.SCOPE_TREINOS_WRITE,
                   mcp_tokens.SCOPE_OPENID, mcp_tokens.SCOPE_EMAIL],
    })
    return TestClient(app)


@pytest.fixture
def auth(mcp_env):
    token, _ = mcp_tokens.emitir_access_token(
        PERSONAL, CONN, [mcp_tokens.SCOPE_READ, mcp_tokens.SCOPE_OPENID,
                         mcp_tokens.SCOPE_EMAIL], "ChatGPT")
    return {"Authorization": f"Bearer {token}"}


# ── Verificação de domínio ──────────────────────────────────────────────────
# "The challenge endpoint must return only that plugin's verification token. Do not
#  return JSON, a list of tokens, or multiple tokens."

def test_challenge_devolve_apenas_o_token_em_texto_puro(cliente, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "openai_apps_challenge", "token-de-verificacao-abc123")

    r = cliente.get("/.well-known/openai-apps-challenge")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/plain")
    assert r.text == "token-de-verificacao-abc123"      # sem JSON, sem lista, sem \n extra


def test_challenge_sem_token_configurado_da_404(cliente, monkeypatch):
    """404 em vez de string vazia: verificação não pode passar por engano.

    O `monkeypatch` para "" não é decoração: `Settings` lê `.env.local`, onde a máquina de
    quem deploya tem o `OPENAI_APPS_CHALLENGE` de verdade. Sem zerar aqui, o teste passava
    no CI (sem o arquivo) e falhava só na máquina do dev — que é o contrário do útil. Mesmo
    motivo do `promo_code_secret` em `test_assinatura_ciclo.py`: teste que depende da
    AUSÊNCIA de config precisa criar a ausência, não torcer pelo ambiente."""
    from app.config import settings
    monkeypatch.setattr(settings, "openai_apps_challenge", "")

    assert cliente.get("/.well-known/openai-apps-challenge").status_code == 404


# ── OIDC / UserInfo ─────────────────────────────────────────────────────────
# "Advertise a UserInfo Endpoint returning user's `email` claim and `email_verified: true`"
# "Enable `openid` and `email` scopes"

def test_metadata_anuncia_userinfo_e_escopos_de_identidade(cliente):
    m = cliente.get("/.well-known/oauth-authorization-server").json()
    assert m["userinfo_endpoint"] == "https://mcp.exemplo.test/userinfo"
    assert "openid" in m["scopes_supported"]
    assert "email" in m["scopes_supported"]
    assert set(m["claims_supported"]) >= {"sub", "email", "email_verified"}


def test_userinfo_devolve_email_verificado(cliente, auth):
    r = cliente.get("/userinfo", headers=auth)
    assert r.status_code == 200
    d = r.json()
    assert d["sub"] == PERSONAL
    assert d["email"] == "personal@exemplo.test"
    assert d["email_verified"] is True


def test_userinfo_nao_vaza_dado_de_aluno(cliente, auth):
    """UserInfo é identidade do personal, não janela para a carteira."""
    d = cliente.get("/userinfo", headers=auth).json()
    assert set(d) <= {"sub", "email", "email_verified"}


def test_userinfo_exige_token(cliente):
    assert cliente.get("/userinfo").status_code == 401


def test_authorize_aceita_escopos_de_identidade(cliente, mcp_env):
    from app.services import mcp_service

    client_id = cliente.post("/register", json={
        "client_name": "ChatGPT", "redirect_uris": ["https://chatgpt.com/cb"]}).json()["client_id"]
    r = cliente.get("/authorize", params={
        "client_id": client_id, "redirect_uri": "https://chatgpt.com/cb",
        "code_challenge": "abc", "code_challenge_method": "S256",
        "scope": "openid email read",
    }, follow_redirects=False)
    assert r.status_code == 302
    req_id = r.headers["location"].split("req=")[1]

    # O personal aprova só o escopo de dado; identidade vai junto, sem ir à tela.
    aprovado = mcp_service.aprovar(req_id, PERSONAL, ["read"], email="p@exemplo.test")
    conexao = mcp_service.listar_conexoes(PERSONAL)[0]
    assert set(conexao["scopes"]) == {"read", "openid", "email"}
    assert conexao["email"] == "p@exemplo.test"
    assert aprovado["code"]


def test_escopo_desconhecido_e_recusado(cliente):
    client_id = cliente.post("/register", json={
        "client_name": "X", "redirect_uris": ["https://x.test/cb"]}).json()["client_id"]
    r = cliente.get("/authorize", params={
        "client_id": client_id, "redirect_uri": "https://x.test/cb",
        "code_challenge": "abc", "code_challenge_method": "S256",
        "scope": "read admin:tudo",
    }, follow_redirects=False)
    assert "error=invalid_scope" in r.headers["location"]


# ── Higiene das respostas ───────────────────────────────────────────────────
# "Remove from responses: unnecessary personal data, auth secrets, debug payloads,
#  internal identifiers, and undisclosed user-related fields"

PROIBIDOS = {"personal_id", "PK", "SK", "GSI1PK", "GSI1SK", "ttl", "acesso_token",
             "session_revoked_before", "telefone", "email", "endereco", "foto_s3_key"}


def _chaves(obj, saida=None):
    saida = saida if saida is not None else set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            saida.add(k)
            _chaves(v, saida)
    elif isinstance(obj, list):
        for i in obj:
            _chaves(i, saida)
    return saida


@pytest.fixture
def carteira(mcp_env):
    repo = mcp_env
    repo.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer("a1"),
                  {"aluno_id": "a1", "nome": "Marina", "status": "ATIVO",
                   "telefone": "5513999998888", "email": "marina@exemplo.test",
                   "endereco": "Rua X, 123", "acesso_token": "tok-secreto"})
    repo.put_item(keys.pk_personal(PERSONAL), keys.sk_agenda("2026-08-20T10:00", "ag1"),
                  {"agendamento_id": "ag1", "aluno_id": "a1", "personal_id": PERSONAL,
                   "created_at": "2026-08-01T00:00:00Z", "status": "AGENDADO",
                   "observacao": "Avaliação"})
    return repo


def _chamar(nome, args, escopos=(mcp_tokens.SCOPE_READ,)):
    from app.mcp import tools as mcp_tools
    from app.mcp.tokens import Tenant, usando_tenant
    t = Tenant(personal_id=PERSONAL, conn_id=CONN, scopes=frozenset(escopos),
               client_name="ChatGPT", jti="j1")
    with usando_tenant(t):
        return mcp_tools.chamar_tool(nome, args, t)


def test_agenda_nao_expoe_identificador_interno(carteira):
    r = _chamar("agenda_periodo", {"data_inicio": "2026-08-01", "data_fim": "2026-08-31"})
    assert not (_chaves(r["structuredContent"]) & PROIBIDOS)


def test_historico_sessoes_nao_expoe_identificador_interno(carteira):
    carteira.put_item(keys.pk_aluno("a1"), keys.sk_sessao_hist("2026-08-01T10:00", "s1"),
                      {"sessao_id": "s1", "personal_id": PERSONAL, "aluno_id": "a1",
                       "status": "FINALIZADA", "treino_nome": "Treino A",
                       "ex_atual": {"nome": "x"}, "ordem_atual": 3, "tem_checkin": False,
                       "volume_total": 1000})
    r = _chamar("historico_sessoes", {"aluno_id": "a1", "limit": 5})
    chaves = _chaves(r["structuredContent"])
    assert not (chaves & PROIBIDOS)
    # Estado de navegação da sessão ao vivo não diz nada sobre o treino executado.
    assert not (chaves & {"ex_atual", "ordem_atual", "tem_checkin"})
    assert "volume_total" in chaves      # o que importa continua lá


def test_listar_alunos_nao_expoe_contato_nem_token(carteira):
    r = _chamar("listar_alunos", {})
    assert not (_chaves(r["structuredContent"]) & PROIBIDOS)


# ── Anotações das tools ─────────────────────────────────────────────────────
# "Tool names, descriptions, schemas, and annotations match actual behavior"

def test_anotacoes_batem_com_o_comportamento_real():
    from app.mcp import tools as mcp_tools
    from app.mcp.tokens import Tenant

    t = Tenant(personal_id=PERSONAL, conn_id=CONN,
               scopes=frozenset({mcp_tokens.SCOPE_READ, mcp_tokens.SCOPE_TREINOS_WRITE}),
               client_name="ChatGPT", jti="j1")
    por_nome = {x["name"]: x for x in mcp_tools.listar_tools(t)}

    for nome, definicao in mcp_tools.TOOLS.items():
        ann = por_nome[nome]["annotations"]
        # readOnlyHint: false se a tool cria, atualiza ou apaga qualquer coisa
        assert ann["readOnlyHint"] == (definicao.escopo == mcp_tokens.SCOPE_READ), nome
        # openWorldHint: false — tudo acontece dentro do CoachPilot, nada é publicado fora
        assert ann["openWorldHint"] is False, nome
        assert isinstance(ann["destructiveHint"], bool), nome

    # destructiveHint true só onde há sobrescrita irreversível de programa
    destrutivas = {n for n, x in por_nome.items() if x["annotations"]["destructiveHint"]}
    assert destrutivas == {"aplicar_programa_treino", "desfazer_alteracao_treino"}


def test_toda_tool_tem_nome_descricao_e_schema():
    from app.mcp import tools as mcp_tools
    from app.mcp.tokens import Tenant

    t = Tenant(personal_id=PERSONAL, conn_id=CONN,
               scopes=frozenset({mcp_tokens.SCOPE_READ, mcp_tokens.SCOPE_TREINOS_WRITE}),
               client_name="ChatGPT", jti="j1")
    for x in mcp_tools.listar_tools(t):
        assert x["name"] and x["title"]
        assert len(x["description"]) >= 40, x["name"]
        assert x["inputSchema"]["type"] == "object", x["name"]
