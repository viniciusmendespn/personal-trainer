"""Regressões do plugin publicado, com escrita visual bloqueada em produção."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.compat.v1 import jsonrpc, tools, treinos, templates, rotinas, mcp_service
from app.config import settings
from app.dependencies import get_current_personal_id
from app.mcp import tokens, ui_resources
from app.repositories import dynamo_repo as repo, keys
from app.services import programa_commit_service as commits, proposta_programa_service as propostas

P, A = "compat-personal", "compat-aluno"
TENANT = tokens.Tenant(personal_id=P, conn_id="c", client_name="ChatGPT", jti="compat",
    scopes=frozenset({tokens.SCOPE_READ, tokens.SCOPE_TREINOS_WRITE}))
NAMES = {"guia_de_prescricao", "listar_alunos", "detalhar_aluno", "exportar_programa_treino",
    "listar_biblioteca_exercicios", "historico_sessoes", "evolucao_exercicio", "resumo_carteira",
    "agenda_periodo", "validar_programa_treino", "aplicar_programa_treino", "atualizar_treino",
    "desfazer_alteracao_treino"}
PROGRAM = {"version": "1", "treinos": [{"nome": "Programa anterior", "exercicios": [
    {"nome": "Supino", "series_prescritas": [{"series": 3, "reps": "10"}]}]}]}


@pytest.fixture
def compat(mcp_env, monkeypatch):
    monkeypatch.setattr(settings, "mcp_compat_mode", True)
    # Mesmo uma configuração incoerente não pode habilitar o novo writer.
    for flag in ("mcp_ui_enabled", "mcp_propostas_enabled", "mcp_aplicacao_enabled"):
        monkeypatch.setattr(settings, flag, True)
    mcp_env.put_item(keys.pk_personal(P), keys.sk_aluno_pointer(A),
        {"aluno_id": A, "nome": "Mariana", "status": "ATIVO", "vigencias": []})
    mcp_env.put_item(keys.pk_personal(P), keys.sk_mcp_conn("c"),
        {"scopes": list(TENANT.scopes), "client_name": "ChatGPT"})
    monkeypatch.setattr(tools.notif_service, "_disparar_push_personal", lambda *a, **k: None)
    def forbidden(*a, **k):
        pytest.fail("O writer legado tentou usar uma transação nova")
    monkeypatch.setattr(repo, "transact_write", forbidden)
    return mcp_env


def call(name, arguments, tenant=TENANT):
    with tokens.usando_tenant(tenant):
        return tools.chamar_tool(name, arguments, tenant)


def payload(result):
    assert not result.get("isError"), result
    assert set(result) == {"content", "structuredContent"}
    assert json.loads(result["content"][0]["text"]) == result["structuredContent"]
    return result["structuredContent"]


def portal():
    app = FastAPI()
    for router in (treinos.router, templates.router, rotinas.router):
        app.include_router(router)
    app.dependency_overrides[get_current_personal_id] = lambda: P
    return TestClient(app)


def test_production_entrypoints_default_to_published_modules():
    env = dict(os.environ, PYTHONPATH=str(Path(__file__).parents[1]))
    env.pop("MCP_COMPAT_MODE", None)
    script = """
from app.config import settings
from app.main import app
from app.mcp.asgi import app as mcp
assert settings.mcp_compat_mode is True
for path, module in [('/v1/alunos/{aluno_id}/treinos/importar', 'treinos'),
                     ('/v1/templates/{template_id}/aplicar', 'templates'),
                     ('/v1/rotinas/{rotina_id}/aplicar', 'rotinas')]:
    route = next(r for r in app.routes if r.path == path and 'POST' in r.methods)
    assert route.endpoint.__module__ == 'app.compat.v1.' + module
route = next(r for r in mcp.routes if r.path == '/mcp' and 'POST' in r.methods)
assert route.endpoint.__module__ == 'app.compat.v1.jsonrpc'
"""
    result = subprocess.run([sys.executable, "-c", script], env=env,
        cwd=Path(__file__).parents[2], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr


def test_captured_files_are_intact():
    root = Path(tools.__file__).parent
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    for name, meta in manifest["files"].items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == meta["adapted_sha256"], name


def test_thirteen_published_descriptors_and_schemas(compat):
    descriptors = tools.listar_tools(TENANT)
    assert {d["name"] for d in descriptors} == NAMES
    assert all("_meta" not in d and "outputSchema" not in d for d in descriptors)
    apply = next(d for d in descriptors if d["name"] == "aplicar_programa_treino")
    assert set(apply["inputSchema"]["properties"]) == {
        "aluno_id", "programa", "resumo_da_mudanca", "confirmar_sessao_em_andamento"}
    read = tokens.Tenant(personal_id=P, conn_id="c", client_name="ChatGPT", jti="r",
        scopes=frozenset({tokens.SCOPE_READ}))
    assert len(tools.listar_tools(read)) == 10


def test_existing_oauth_token_initializes_without_visual_capabilities(compat):
    app = FastAPI()
    app.include_router(jsonrpc.router)
    client = TestClient(app)
    body = {"jsonrpc": "2.0", "id": 1, "method": "initialize"}
    assert client.post("/mcp", json=body).status_code == 401
    token, _ = tokens.emitir_access_token(P, "c", list(TENANT.scopes), "ChatGPT")
    headers = {"Authorization": f"Bearer {token}"}
    result = client.post("/mcp", json=body, headers=headers).json()["result"]
    assert result["capabilities"] == {"tools": {"listChanged": False}, "prompts": {"listChanged": False}}
    body["method"] = "tools/list"
    assert len(client.post("/mcp", json=body, headers=headers).json()["result"]["tools"]) == 13
    body["method"] = "resources/list"
    assert client.post("/mcp", json=body, headers=headers).json()["error"]["code"] == -32601


def test_guide_and_exports_keep_the_published_format(compat):
    result = payload(call("exportar_programa_treino", {"aluno_id": A, "incluir_contexto": False}))
    assert result["version"] == "1" and "revisao" not in result
    guide = call("guia_de_prescricao", {})["content"][0]["text"]
    assert "aplicar_programa_treino" in guide and "salvar_proposta_programa" not in guide


def large_program():
    return {"version": "1", "treinos": [{"nome": "Programa grande", "exercicios": [
        {"nome": f"Exercício {i}", "series_prescritas": [{"series": 3, "reps": "10"}]}
        for i in range(110)]}]}


def test_existing_tool_keeps_large_programs_and_idempotence(compat):
    args = {"aluno_id": A, "programa": large_program(), "resumo_da_mudanca": "Teste compatível"}
    first = payload(call("aplicar_programa_treino", args))
    assert first["status"] == "aplicado" and first["exercicios"] == 110
    again = payload(call("aplicar_programa_treino", args))
    assert again["status"] == "ja_aplicado"
    assert len(compat.query_pk(keys.pk_aluno(A), "EX#")) == 110
    assert commits.revisao(A) == 0


def test_portal_import_keeps_large_programs_without_revision(compat):
    result = portal().post(f"/v1/alunos/{A}/treinos/importar", json={"conteudo": json.dumps(large_program())})
    assert result.status_code == 201, result.text
    assert result.json()["exercicios_importados"] == 110
    assert len(compat.query_pk(keys.pk_aluno(A), "EX#")) == 110


def test_undo_accepts_snapshot_created_before_this_deploy(compat):
    ts = "2026-09-30T12:00:00+00:00"
    compat.put_item(keys.pk_aluno(A), keys.sk_mcp_snap(ts), {
        "ts": ts, "programa": json.dumps(PROGRAM), "tool": "aplicar_programa_treino",
        "client_name": "ChatGPT", "ttl": int(time.time()) + 3600})
    result = payload(call("desfazer_alteracao_treino", {"aluno_id": A}))
    assert result["status"] == "restaurado" and result["de"] == ts
    assert [t["nome"] for t in compat.query_pk(keys.pk_aluno(A), "TREINO#")] == ["Programa anterior"]
    assert mcp_service.ultimo_snapshot(A) is None
    assert commits.revisao(A) == 0


def test_compatibility_blocks_new_writers_even_when_all_flags_are_enabled(compat):
    assert ui_resources.listar()[0]["uri"] == ui_resources.URI
    assert call("abrir_coachpilot", {})["isError"]
    with pytest.raises(HTTPException) as error:
        propostas.salvar(P, A, PROGRAM, "Teste", 0)
    assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        commits.commit(P, A, 0)
    assert error.value.status_code == 503
    from app.scheduler import _processar_programas
    assert _processar_programas("2026-09-30") == 0
    assert not compat.query_pk(keys.pk_personal(P), "PROPOSTA#")


def test_portal_crud_and_templates_keep_legacy_writes(compat):
    client = portal()
    made = client.post(f"/v1/alunos/{A}/treinos", json={"nome": "Treino do portal"})
    assert made.status_code == 201, made.text
    tid = made.json()["treino_id"]
    changed = client.put(f"/v1/alunos/{A}/treinos/{tid}", json={"nome": "Editado"})
    assert changed.status_code == 200, changed.text
    exercise = client.post(f"/v1/alunos/{A}/treinos/{tid}/exercicios", json={"nome": "Supino"})
    assert exercise.status_code == 201, exercise.text
    template = client.post("/v1/templates/from-treino", json={"aluno_id": A, "treino_id": tid, "nome": "Modelo"})
    assert template.status_code == 201, template.text
    applied = client.post(f"/v1/templates/{template.json()['template_id']}/aplicar", json={"aluno_ids": [A]})
    assert applied.status_code == 200, applied.text
    assert commits.revisao(A) == 0


def test_old_tool_still_refuses_another_tenant(compat):
    other = tokens.Tenant(personal_id="other", conn_id="c", client_name="ChatGPT", jti="x", scopes=TENANT.scopes)
    before = dict(compat.itens)
    result = call("aplicar_programa_treino", {"aluno_id": A, "programa": PROGRAM, "resumo_da_mudanca": "x"}, other)
    assert result["isError"] and "não encontrado" in result["content"][0]["text"]
    assert compat.itens == before


def test_legacy_session_confirmation_is_preserved(compat):
    compat.put_item(keys.pk_aluno(A), keys.SK_SESSION_ACTIVE,
        {"treino_id": "current", "treino_nome": "Treino em andamento", "desde": "2026-09-30"})
    client = portal()
    body = {"conteudo": json.dumps(PROGRAM)}
    assert client.post(f"/v1/alunos/{A}/treinos/importar", json=body).status_code == 409
    assert not compat.query_pk(keys.pk_aluno(A), "TREINO#")
    body["confirmar"] = True
    assert client.post(f"/v1/alunos/{A}/treinos/importar", json=body).status_code == 201


def test_routine_application_keeps_legacy_writes(compat):
    compat.put_item(keys.pk_personal(P), keys.sk_rotina("r"), {
        "rotina_id": "r", "nome": "Rotina", "personal_id": P, "created_at": "2026-09-30",
        "treinos": [{"nome": "A", "ordem": 0,
            "exercicios": [{"nome": "Supino", "series_prescritas": [{"series": 3, "reps": "10"}]}]}]})
    response = portal().post("/v1/rotinas/r/aplicar", json={"aluno_ids": [A], "modo": "substituir"})
    assert response.status_code == 200, response.text
    assert len(compat.query_pk(keys.pk_aluno(A), "TREINO#")) == 1
    assert commits.revisao(A) == 0


def test_snapshot_marks_writers_as_open_world_and_keeps_the_rest_published(compat):
    """Única correção no snapshot: openWorldHint das tools de escrita (revisão do ChatGPT)."""
    tenant = tokens.Tenant(personal_id=P, conn_id="c", client_name="ChatGPT", jti="w",
        scopes=frozenset({tokens.SCOPE_READ, tokens.SCOPE_TREINOS_WRITE}))
    anotacoes = {d["name"]: d["annotations"] for d in tools.listar_tools(tenant)}
    assert len(anotacoes) == 13
    abertas = {n for n, a in anotacoes.items() if a["openWorldHint"]}
    assert abertas == {"aplicar_programa_treino", "atualizar_treino", "desfazer_alteracao_treino"}
    assert all(a["openWorldHint"] is not a["readOnlyHint"] for a in anotacoes.values())
