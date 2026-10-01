"""Novas consultas visuais coexistem com o contrato publicado e não gravam treinos."""
import copy

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.compat.v1 import tools as legacy
from app.config import settings
from app.mcp import compat_visual_jsonrpc as rpc, compat_visual_tools as visual, tokens, ui_resources
from app.repositories import keys

P, A = "visual-personal", "visual-aluno"
TENANT = tokens.Tenant(personal_id=P, conn_id="c", client_name="ChatGPT", jti="v",
    scopes=frozenset({tokens.SCOPE_READ, tokens.SCOPE_TREINOS_WRITE}))


@pytest.fixture
def visual_env(mcp_env, monkeypatch):
    for name in ("mcp_compat_mode", "mcp_ui_enabled", "mcp_propostas_enabled", "mcp_aplicacao_enabled"):
        monkeypatch.setattr(settings, name, True)
    mcp_env.put_item(keys.pk_personal(P), keys.sk_aluno_pointer(A),
        {"aluno_id": A, "nome": "Márcia", "status": "ATIVO", "vigencias": []})
    mcp_env.put_item(keys.pk_aluno(A), keys.SK_PROFILE, {"nome": "Márcia"})
    mcp_env.put_item(keys.pk_personal(P), keys.sk_mcp_conn("c"),
        {"scopes": list(TENANT.scopes), "client_name": "ChatGPT"})
    return mcp_env


def dispatch(method, params=None, tenant=TENANT):
    with tokens.usando_tenant(tenant):
        return rpc._tratar(method, params or {}, 1, tenant)


def call(name, args=None, tenant=TENANT):
    return dispatch("tools/call", {"name": name, "arguments": args or {}}, tenant)["result"]


def test_published_contract_is_preserved_with_visual_enabled(visual_env):
    published = legacy.listar_tools(TENANT)
    descriptors = dispatch("tools/list")["result"]["tools"]
    assert descriptors[:13] == published
    assert {d["name"] for d in descriptors[13:]} == set(visual.DEFINICOES)
    assert all(d["annotations"]["readOnlyHint"] for d in descriptors[13:])
    with tokens.usando_tenant(TENANT):
        expected = legacy.chamar_tool("exportar_programa_treino", {"aluno_id": A, "incluir_contexto": False}, TENANT)
    assert call("exportar_programa_treino", {"aluno_id": A, "incluir_contexto": False}) == expected
    assert call("salvar_proposta_programa", {"aluno_id": A})["isError"]


def test_visual_consultations_never_write_even_with_all_flags_enabled(visual_env):
    before = copy.deepcopy(visual_env.itens)
    for name, args in (("abrir_coachpilot", {}), ("abrir_coachpilot", {"aluno_id": A}),
                       ("mostrar_aluno", {"aluno_id": A})):
        result = call(name, args)
        assert not result.get("isError"), result
        summary = result["structuredContent"]
        assert summary["somente_leitura"] is True
        assert summary["propostas_disponiveis"] is summary["aplicacao_disponivel"] is False
        assert summary["carteira_tool"] == "consultar_carteira_visual"
        assert "revisao" not in summary
    filtered = call("consultar_carteira_visual", {"busca": "MARCIA", "limit": 1})
    assert [item["aluno_id"] for item in filtered["structuredContent"]["items"]] == [A]
    assert visual_env.itens == before


@pytest.mark.parametrize("name", ["abrir_coachpilot", "mostrar_aluno"])
def test_visual_rejects_other_tenant_before_reading_student(visual_env, name):
    other = tokens.Tenant(personal_id="other", conn_id="c", client_name="ChatGPT", jti="o", scopes=TENANT.scopes)
    result = call(name, {"aluno_id": A}, other)
    assert result["isError"] and "não encontrado" in result["content"][0]["text"]
    assert call("consultar_carteira_visual", {}, other)["structuredContent"]["items"] == []


def test_visual_filters_paginate_without_reusing_old_tool_schema(visual_env):
    visual_env.put_item(keys.pk_personal(P), keys.sk_aluno_pointer("second"),
        {"aluno_id": "second", "nome": "Ana", "status": "ATIVO", "vigencias": []})
    first = call("consultar_carteira_visual", {"limit": 1})["structuredContent"]
    assert first["next_cursor"] and not first["cobertura"]["completa"]
    second = call("consultar_carteira_visual", {"limit": 1, "cursor": first["next_cursor"]})["structuredContent"]
    assert first["items"][0]["aluno_id"] != second["items"][0]["aluno_id"]
    assert second["cobertura"]["completa"]
    assert call("mostrar_aluno", {"aluno_id": A, "personal_id": "other"})["isError"]


def test_visual_discovery_uses_existing_oauth_and_flag_can_disable_it(visual_env, monkeypatch):
    app = FastAPI()
    app.include_router(rpc.router)
    client = TestClient(app)
    body = {"jsonrpc": "2.0", "id": 1, "method": "resources/read", "params": {"uri": ui_resources.URI}}
    assert client.post("/mcp", json=body).status_code == 401
    token, _ = tokens.emitir_access_token(P, "c", list(TENANT.scopes), "ChatGPT")
    response = client.post("/mcp", json=body, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["result"]["contents"][0]["mimeType"] == ui_resources.MIME
    assert "resources" in dispatch("initialize")["result"]["capabilities"]
    monkeypatch.setattr(settings, "mcp_ui_enabled", False)
    assert dispatch("tools/list")["result"]["tools"] == legacy.listar_tools(TENANT)
    assert dispatch("resources/list")["error"]["code"] == -32601
    assert call("abrir_coachpilot")["isError"]


def test_visual_connection_without_read_scope_cannot_discover_or_call(visual_env):
    tenant = tokens.Tenant(personal_id=P, conn_id="c", client_name="ChatGPT", jti="n", scopes=frozenset())
    assert visual.listar_tools(tenant) == []
    assert call("mostrar_aluno", {"aluno_id": A}, tenant)["isError"]


def test_bundle_da_interface_traz_o_css_e_domain_existente():
    """O build já gerou `<style></style>` vazio (plugin rodava antes do CSS do Vite), e o
    `domain` já apontou para um subdomínio inexistente — o botão "Abrir em" do ChatGPT leva lá."""
    import re
    html = (ui_resources.DIST / "v1.html").read_text(encoding="utf-8")
    css = re.search(r"<style>(.*?)</style>", html, re.S).group(1)
    assert "--color-accent" in css and "font-face" in css and len(css) > 1000
    assert settings.mcp_ui_domain == "https://coachpilot.com.br"
