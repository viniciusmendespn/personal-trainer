"""O contrato publicado no ChatGPT não muda sem querer.

`fixtures/mcp_contrato_publicado.json` foi gravado de produção em 01/10/2026: as 13 tools
publicadas + as 3 consultas visuais, `instructions`, prompts e resources. Mudar qualquer
coisa aqui (nome, schema, descrição, anotação) exige Rescan/nova revisão do app no ChatGPT —
só atualize o fixture de propósito, junto com essa decisão.
"""
import json
from pathlib import Path

import pytest

from app.config import settings
from app.mcp import tokens, visual_jsonrpc as rpc

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "mcp_contrato_publicado.json").read_text(encoding="utf-8"))
ESCRITA = tokens.Tenant(personal_id="p", conn_id="c", client_name="ChatGPT", jti="j",
                        scopes=frozenset({tokens.SCOPE_READ, tokens.SCOPE_TREINOS_WRITE}))
LEITURA = tokens.Tenant(personal_id="p", conn_id="c", client_name="ChatGPT", jti="j",
                        scopes=frozenset({tokens.SCOPE_READ}))


@pytest.fixture(autouse=True)
def ui_ligada(monkeypatch):
    monkeypatch.setattr(settings, "mcp_ui_enabled", True)


def _tratar(metodo, tenant=ESCRITA):
    with tokens.usando_tenant(tenant):
        return rpc._tratar(metodo, {}, 1, tenant)


def test_tools_identicas_as_publicadas():
    assert _tratar("tools/list")["result"]["tools"] == FIXTURE["tools_leitura_escrita"]


def test_conexao_somente_leitura_nao_ve_escrita():
    nomes = [t["name"] for t in _tratar("tools/list", LEITURA)["result"]["tools"]]
    assert nomes == FIXTURE["tools_somente_leitura"]


def test_initialize_prompts_e_resources_identicos():
    init = _tratar("initialize")["result"]
    assert init["instructions"] == FIXTURE["instructions"]
    assert init["capabilities"] == FIXTURE["capabilities"]
    assert init["serverInfo"] == FIXTURE["serverInfo"]
    for metodo in ("prompts/list", "resources/list", "resources/templates/list"):
        assert _tratar(metodo)["result"] == FIXTURE[metodo], metodo


def test_escrita_declara_open_world_e_leitura_nao():
    """Apontado pela revisão do ChatGPT: escrita muda o app do aluno e dispara avisos."""
    for t in FIXTURE["tools_leitura_escrita"]:
        ann = t["annotations"]
        assert ann["openWorldHint"] is (not ann["readOnlyHint"]), t["name"]
