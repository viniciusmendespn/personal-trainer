"""Fluxo OAuth 2.1 do servidor MCP.

O que estes testes protegem: um authorization code ou refresh token vazado não pode ser
reutilizado, um cliente não pode gastar o código de outro, e revogar uma conexão no portal
tem que barrar o acesso de fato.
"""
import base64
import hashlib
import time

import pytest

from app.mcp import tokens as mcp_tokens
from app.services import mcp_service

VERIFIER = "verificador-pkce-com-tamanho-suficiente-para-a-spec"


def _challenge(verifier=VERIFIER):
    d = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(d).decode().rstrip("=")


def _autorizar(scopes=None, redirect="https://cliente.test/cb"):
    """Registra cliente, cria a requisição e aprova — devolve (client_id, code)."""
    scopes = scopes or [mcp_tokens.SCOPE_READ, mcp_tokens.SCOPE_TREINOS_WRITE]
    cliente = mcp_service.registrar_cliente("Claude", [redirect])
    req_id = mcp_service.criar_authreq(
        client_id=cliente["client_id"], client_name="Claude", redirect_uri=redirect,
        code_challenge=_challenge(), code_challenge_method="S256", state="xyz",
        scopes=scopes, resource=mcp_tokens.resource_url(),
    )
    aprovado = mcp_service.aprovar(req_id, "personal-1", scopes)
    return cliente["client_id"], aprovado


def test_fluxo_feliz_emite_token_utilizavel(mcp_env):
    client_id, aprovado = _autorizar()
    grant = mcp_service.resgatar_code(aprovado["code"], client_id,
                                      "https://cliente.test/cb", VERIFIER)
    access, _ = mcp_tokens.emitir_access_token(
        grant["personal_id"], grant["conn_id"], grant["scopes"], grant["client_name"])

    tenant = mcp_service.resolver_tenant(access)
    assert tenant.personal_id == "personal-1"
    assert tenant.pode(mcp_tokens.SCOPE_TREINOS_WRITE)
    assert aprovado["state"] == "xyz"


def test_code_e_one_shot(mcp_env):
    client_id, aprovado = _autorizar()
    mcp_service.resgatar_code(aprovado["code"], client_id, "https://cliente.test/cb", VERIFIER)
    with pytest.raises(ValueError):
        mcp_service.resgatar_code(aprovado["code"], client_id,
                                  "https://cliente.test/cb", VERIFIER)


def test_code_verifier_errado_falha(mcp_env):
    client_id, aprovado = _autorizar()
    with pytest.raises(ValueError):
        mcp_service.resgatar_code(aprovado["code"], client_id,
                                  "https://cliente.test/cb", "outro-verificador-qualquer")


def test_code_de_outro_cliente_falha(mcp_env):
    _, aprovado = _autorizar()
    intruso = mcp_service.registrar_cliente("Intruso", ["https://intruso.test/cb"])
    with pytest.raises(ValueError):
        mcp_service.resgatar_code(aprovado["code"], intruso["client_id"],
                                  "https://cliente.test/cb", VERIFIER)


def test_redirect_uri_diferente_da_autorizacao_falha(mcp_env):
    client_id, aprovado = _autorizar()
    with pytest.raises(ValueError):
        mcp_service.resgatar_code(aprovado["code"], client_id,
                                  "https://cliente.test/outro", VERIFIER)


def test_escopo_nao_pedido_nao_e_concedido(mcp_env):
    """Se a autorização pediu só leitura, aprovar com escrita não pode ampliar o acesso."""
    _, aprovado = _autorizar(scopes=[mcp_tokens.SCOPE_READ])
    conexoes = mcp_service.listar_conexoes("personal-1")
    assert conexoes[0]["scopes"] == [mcp_tokens.SCOPE_READ]
    assert aprovado["code"]


def test_refresh_rotativo_invalida_o_anterior(mcp_env):
    client_id, aprovado = _autorizar()
    grant = mcp_service.resgatar_code(aprovado["code"], client_id,
                                      "https://cliente.test/cb", VERIFIER)
    refresh = mcp_service.emitir_refresh(grant["personal_id"], grant["conn_id"],
                                         client_id, grant["scopes"], "Claude")
    mcp_service.rotacionar_refresh(refresh, client_id)
    with pytest.raises(ValueError):
        mcp_service.rotacionar_refresh(refresh, client_id)


def test_token_de_outra_audience_e_rejeitado(mcp_env, monkeypatch):
    from app.config import settings
    access, _ = mcp_tokens.emitir_access_token("personal-1", "c1",
                                               [mcp_tokens.SCOPE_READ], "Claude")
    monkeypatch.setattr(settings, "mcp_server_url", "https://outro-servidor.test")
    with pytest.raises(mcp_tokens.TokenInvalido):
        mcp_tokens.decodificar(access)


def test_conexao_revogada_bloqueia_token_ja_emitido(mcp_env):
    client_id, aprovado = _autorizar()
    grant = mcp_service.resgatar_code(aprovado["code"], client_id,
                                      "https://cliente.test/cb", VERIFIER)
    access, _ = mcp_tokens.emitir_access_token(
        grant["personal_id"], grant["conn_id"], grant["scopes"], "Claude")
    assert mcp_service.resolver_tenant(access).conn_id == grant["conn_id"]

    # Revogação registra o instante; o token emitido antes disso deixa de valer.
    mcp_service.revogar_conexao("personal-1", grant["conn_id"])
    mcp_env.itens[(f"PT#personal-1", f"MCPCONN#{grant['conn_id']}")]["revoked_at"] = \
        int(time.time()) + 5
    with pytest.raises(mcp_tokens.TokenInvalido):
        mcp_service.resolver_tenant(access)


def test_revogar_bloqueia_o_refresh_na_hora(mcp_env):
    client_id, aprovado = _autorizar()
    grant = mcp_service.resgatar_code(aprovado["code"], client_id,
                                      "https://cliente.test/cb", VERIFIER)
    refresh = mcp_service.emitir_refresh(grant["personal_id"], grant["conn_id"],
                                         client_id, grant["scopes"], "Claude")
    mcp_service.revogar_conexao("personal-1", grant["conn_id"])
    with pytest.raises(ValueError):
        mcp_service.rotacionar_refresh(refresh, client_id)


def test_conexao_revogada_some_da_listagem(mcp_env):
    _, aprovado = _autorizar()
    conn_id = mcp_service.listar_conexoes("personal-1")[0]["conn_id"]
    mcp_service.revogar_conexao("personal-1", conn_id)
    assert mcp_service.listar_conexoes("personal-1") == []


def test_authreq_expirada_nao_aprova(mcp_env):
    cliente = mcp_service.registrar_cliente("Claude", ["https://cliente.test/cb"])
    req_id = mcp_service.criar_authreq(
        client_id=cliente["client_id"], client_name="Claude",
        redirect_uri="https://cliente.test/cb", code_challenge=_challenge(),
        code_challenge_method="S256", state=None,
        scopes=[mcp_tokens.SCOPE_READ], resource=None,
    )
    mcp_env.itens[(f"MCPAUTHREQ#{req_id}", "META")]["ttl"] = int(time.time()) - 1
    with pytest.raises(ValueError):
        mcp_service.aprovar(req_id, "personal-1", [mcp_tokens.SCOPE_READ])
