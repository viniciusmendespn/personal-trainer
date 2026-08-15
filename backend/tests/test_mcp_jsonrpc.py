"""Transporte MCP (Streamable HTTP stateless) e descoberta OAuth.

O transporte é escrito à mão em vez de vir do SDK `mcp` — então o contrato com os clientes
(Claude, ChatGPT, Gemini, MCP Inspector) precisa estar coberto por teste, sobretudo o 401
com `WWW-Authenticate`: é por ele que o cliente descobre que deve iniciar o OAuth em vez
de simplesmente desistir.
"""
import pytest
from fastapi.testclient import TestClient

from app.mcp import jsonrpc, tokens as mcp_tokens
from app.mcp.asgi import app
from app.repositories import keys

PERSONAL = "personal-1"
CONN = "conn-1"


@pytest.fixture
def cliente(mcp_env):
    mcp_env.put_item(keys.pk_personal(PERSONAL), keys.sk_mcp_conn(CONN), {
        "conn_id": CONN, "client_name": "Claude",
        "scopes": [mcp_tokens.SCOPE_READ, mcp_tokens.SCOPE_TREINOS_WRITE],
    })
    return TestClient(app)


@pytest.fixture
def auth(mcp_env):
    token, _ = mcp_tokens.emitir_access_token(
        PERSONAL, CONN, [mcp_tokens.SCOPE_READ, mcp_tokens.SCOPE_TREINOS_WRITE], "Claude")
    return {"Authorization": f"Bearer {token}"}


def _rpc(cliente, auth, metodo, params=None, req_id=1):
    return cliente.post("/mcp", headers=auth, json={
        "jsonrpc": "2.0", "id": req_id, "method": metodo, "params": params or {}})


# ── autenticação ────────────────────────────────────────────────────────────

def test_sem_token_devolve_401_apontando_para_os_metadados(cliente):
    r = cliente.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "initialize"})
    assert r.status_code == 401
    assert "resource_metadata=" in r.headers["www-authenticate"]
    assert ".well-known/oauth-protected-resource" in r.headers["www-authenticate"]


def test_token_forjado_e_rejeitado(cliente):
    r = cliente.post("/mcp", headers={"Authorization": "Bearer nao.e.um.jwt"},
                     json={"jsonrpc": "2.0", "id": 1, "method": "initialize"})
    assert r.status_code == 401


# ── handshake ───────────────────────────────────────────────────────────────

def test_initialize_negocia_versao_e_anuncia_capacidades(cliente, auth):
    r = _rpc(cliente, auth, "initialize", {"protocolVersion": "2025-03-26"})
    resultado = r.json()["result"]
    assert resultado["protocolVersion"] == "2025-03-26"      # ecoa a versão do cliente
    assert resultado["capabilities"]["tools"] == {"listChanged": False}
    assert resultado["serverInfo"]["name"] == "coachpilot"
    assert "instructions" in resultado


def test_versao_desconhecida_cai_na_nossa(cliente, auth):
    r = _rpc(cliente, auth, "initialize", {"protocolVersion": "1999-01-01"})
    assert r.json()["result"]["protocolVersion"] == jsonrpc.PROTOCOL_VERSION


def test_notificacao_nao_tem_corpo(cliente, auth):
    r = cliente.post("/mcp", headers=auth,
                     json={"jsonrpc": "2.0", "method": "notifications/initialized"})
    assert r.status_code == 202
    assert r.content == b""


def test_ping(cliente, auth):
    assert _rpc(cliente, auth, "ping").json()["result"] == {}


# ── tools e prompts ─────────────────────────────────────────────────────────

def test_tools_list_traz_schema_valido_em_todas(cliente, auth):
    tools = _rpc(cliente, auth, "tools/list").json()["result"]["tools"]
    assert len(tools) >= 10
    for t in tools:
        assert t["inputSchema"]["type"] == "object"
        assert t["description"] and t["name"]
        assert "readOnlyHint" in t["annotations"]


def test_tool_desconhecida_volta_como_erro_de_tool(cliente, auth):
    """Erro de tool é resultado com isError, não erro JSON-RPC: assim o LLM lê a mensagem
    e se corrige em vez de abortar a conversa."""
    resultado = _rpc(cliente, auth, "tools/call",
                     {"name": "inventada", "arguments": {}}).json()["result"]
    assert resultado["isError"] is True
    assert "não existe" in resultado["content"][0]["text"]


def test_argumentos_invalidos_viram_mensagem_acionavel(cliente, auth):
    resultado = _rpc(cliente, auth, "tools/call",
                     {"name": "detalhar_aluno", "arguments": {}}).json()["result"]
    assert resultado["isError"] is True
    assert "argumentos inválidos" in resultado["content"][0]["text"]


def test_metodo_desconhecido_vira_erro_jsonrpc(cliente, auth):
    erro = _rpc(cliente, auth, "recursos/listar").json()["error"]
    assert erro["code"] == jsonrpc.METHOD_NOT_FOUND


def test_prompts_expoe_as_regras_de_montagem(cliente, auth):
    nomes = [p["name"] for p in _rpc(cliente, auth, "prompts/list").json()["result"]["prompts"]]
    assert "montar_treino" in nomes
    texto = _rpc(cliente, auth, "prompts/get",
                 {"name": "montar_treino"}).json()["result"]["messages"][0]["content"]["text"]
    assert "REGRAS DE OURO" in texto


# ── stateless ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("metodo", ["get", "delete"])
def test_sem_sessao_nem_stream(cliente, metodo):
    assert getattr(cliente, metodo)("/mcp").status_code == 405


def test_batch_jsonrpc_e_recusado(cliente, auth):
    """Batching saiu do MCP em 2025-06-18."""
    r = cliente.post("/mcp", headers=auth,
                     json=[{"jsonrpc": "2.0", "id": 1, "method": "ping"}])
    assert r.status_code == 400
    assert r.json()["error"]["code"] == jsonrpc.INVALID_REQUEST


# ── descoberta ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("caminho", [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
])
def test_metadados_do_recurso(cliente, caminho):
    dados = cliente.get(caminho).json()
    assert dados["resource"] == "https://mcp.exemplo.test/mcp"
    assert dados["authorization_servers"] == ["https://mcp.exemplo.test"]


def test_metadados_do_authorization_server(cliente):
    dados = cliente.get("/.well-known/oauth-authorization-server").json()
    assert dados["code_challenge_methods_supported"] == ["S256"]
    assert dados["registration_endpoint"].endswith("/register")
    assert set(dados["grant_types_supported"]) == {"authorization_code", "refresh_token"}


# ── registro e autorização ──────────────────────────────────────────────────

def test_register_recusa_redirect_insegura(cliente):
    r = cliente.post("/register", json={"client_name": "X",
                                        "redirect_uris": ["http://evil.test/cb"]})
    assert r.status_code == 400
    assert r.json()["error"] == "invalid_redirect_uri"


def test_register_aceita_localhost(cliente):
    r = cliente.post("/register", json={"client_name": "Inspector",
                                        "redirect_uris": ["http://localhost:6274/cb"]})
    assert r.status_code == 201
    assert r.json()["token_endpoint_auth_method"] == "none"


def test_authorize_leva_ao_consentimento_no_portal(cliente):
    client_id = cliente.post("/register", json={
        "client_name": "Claude", "redirect_uris": ["https://claude.ai/cb"]}).json()["client_id"]
    r = cliente.get("/authorize", params={
        "client_id": client_id, "redirect_uri": "https://claude.ai/cb",
        "code_challenge": "abc", "code_challenge_method": "S256", "state": "s1",
    }, follow_redirects=False)
    assert r.status_code == 302
    assert r.headers["location"].startswith("https://portal.exemplo.test/oauth/consent?req=")


def test_authorize_recusa_redirect_nao_registrada(cliente):
    """Sem redirect confiável o erro não pode voltar pela redirect_uri — seria um
    redirect aberto."""
    client_id = cliente.post("/register", json={
        "client_name": "Claude", "redirect_uris": ["https://claude.ai/cb"]}).json()["client_id"]
    r = cliente.get("/authorize", params={
        "client_id": client_id, "redirect_uri": "https://atacante.test/cb",
        "code_challenge": "abc", "code_challenge_method": "S256",
    }, follow_redirects=False)
    assert r.status_code == 400
    assert r.json()["error"] == "invalid_redirect_uri"


def test_token_troca_code_por_access_e_refresh(cliente, mcp_env):
    """Round trip HTTP completo. Cobre o /token de ponta a ponta: ele lê o corpo
    urlencoded à mão (Form do FastAPI exigiria python-multipart, que não está no
    requirements) — um teste só no service não pegaria isso."""
    import base64
    import hashlib

    from app.services import mcp_service

    verifier = "verificador-pkce-suficientemente-longo-para-a-spec"
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")

    client_id = cliente.post("/register", json={
        "client_name": "Claude", "redirect_uris": ["https://claude.ai/cb"]}).json()["client_id"]
    req_id = cliente.get("/authorize", params={
        "client_id": client_id, "redirect_uri": "https://claude.ai/cb",
        "code_challenge": challenge, "code_challenge_method": "S256", "state": "s1",
        "scope": "read",
    }, follow_redirects=False).headers["location"].split("req=")[1]

    aprovado = mcp_service.aprovar(req_id, PERSONAL, ["read"])   # o portal faria isso

    r = cliente.post("/token", data={
        "grant_type": "authorization_code", "client_id": client_id,
        "code": aprovado["code"], "redirect_uri": "https://claude.ai/cb",
        "code_verifier": verifier,
    })
    assert r.status_code == 200, r.text
    dados = r.json()
    assert dados["token_type"] == "Bearer"
    assert dados["scope"] == "read"
    assert r.headers["cache-control"] == "no-store"

    # O access token emitido pelo /token funciona de verdade no /mcp.
    tools = cliente.post("/mcp", headers={"Authorization": f"Bearer {dados['access_token']}"},
                         json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}).json()
    nomes = {t["name"] for t in tools["result"]["tools"]}
    assert "listar_alunos" in nomes
    assert "aplicar_programa_treino" not in nomes      # só pediu escopo de leitura

    # E o refresh devolvido troca por um novo par.
    r2 = cliente.post("/token", data={"grant_type": "refresh_token", "client_id": client_id,
                                      "refresh_token": dados["refresh_token"]})
    assert r2.status_code == 200
    assert r2.json()["refresh_token"] != dados["refresh_token"]


def test_app_importa_sem_python_multipart():
    """Reproduz o ambiente da Lambda, onde `python-multipart` não existe.

    Este é o bug que derrubou o primeiro deploy: `Form(...)` do FastAPI valida a dependência
    já na definição da rota, então o módulo inteiro falhava no import e todo endpoint
    devolvia 500 — inclusive os `.well-known`. Aqui o import roda com o pacote bloqueado.
    """
    import importlib
    import sys
    from unittest.mock import patch

    bloqueado = {"multipart": None, "python_multipart": None,
                 "multipart.multipart": None}
    with patch.dict(sys.modules, bloqueado):
        for modulo in ("app.mcp.oauth", "app.mcp.jsonrpc", "app.mcp.asgi"):
            importlib.reload(importlib.import_module(modulo))

    # Recarrega sem o bloqueio para não deixar os módulos remendados para os outros testes.
    for modulo in ("app.mcp.oauth", "app.mcp.jsonrpc", "app.mcp.asgi"):
        importlib.reload(importlib.import_module(modulo))


def test_token_com_code_invalido(cliente):
    r = cliente.post("/token", data={"grant_type": "authorization_code", "client_id": "x",
                                     "code": "inexistente", "redirect_uri": "https://a.test/cb",
                                     "code_verifier": "v"})
    assert r.status_code == 400
    assert r.json()["error"] == "invalid_grant"


def test_token_com_grant_nao_suportado(cliente):
    r = cliente.post("/token", data={"grant_type": "client_credentials"})
    assert r.json()["error"] == "unsupported_grant_type"


def test_authorize_exige_pkce_s256(cliente):
    client_id = cliente.post("/register", json={
        "client_name": "Claude", "redirect_uris": ["https://claude.ai/cb"]}).json()["client_id"]
    r = cliente.get("/authorize", params={
        "client_id": client_id, "redirect_uri": "https://claude.ai/cb",
        "code_challenge": "", "code_challenge_method": "plain", "state": "s1",
    }, follow_redirects=False)
    assert r.status_code == 302
    assert "error=invalid_request" in r.headers["location"]
    assert "state=s1" in r.headers["location"]
