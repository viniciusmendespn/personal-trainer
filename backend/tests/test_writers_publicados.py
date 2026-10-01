"""Regressões dos writers que rodam em produção: tools publicadas do MCP e portal.

Programa grande sem limite de transação, idempotência, desfazer por snapshot, confirmação de
sessão ativa, CRUD/templates/rotinas do portal e isolamento de tenant.
"""
import json
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.dependencies import get_current_personal_id
from app.mcp import tokens, tools
from app.repositories import keys
from app.routers import rotinas, templates, treinos
from app.services import mcp_service

P, A = "writers-personal", "writers-aluno"
TENANT = tokens.Tenant(personal_id=P, conn_id="c", client_name="ChatGPT", jti="w",
    scopes=frozenset({tokens.SCOPE_READ, tokens.SCOPE_TREINOS_WRITE}))
PROGRAM = {"version": "1", "treinos": [{"nome": "Programa anterior", "exercicios": [
    {"nome": "Supino", "series_prescritas": [{"series": 3, "reps": "10"}]}]}]}


@pytest.fixture
def env(mcp_env, monkeypatch):
    mcp_env.put_item(keys.pk_personal(P), keys.sk_aluno_pointer(A),
        {"aluno_id": A, "nome": "Mariana", "status": "ATIVO", "vigencias": []})
    mcp_env.put_item(keys.pk_personal(P), keys.sk_mcp_conn("c"),
        {"scopes": list(TENANT.scopes), "client_name": "ChatGPT"})
    monkeypatch.setattr(tools.notif_service, "_disparar_push_personal", lambda *a, **k: None)
    return mcp_env


def call(name, arguments, tenant=TENANT):
    with tokens.usando_tenant(tenant):
        return tools.chamar_tool(name, arguments, tenant)


def payload(result):
    assert not result.get("isError"), result
    assert json.loads(result["content"][0]["text"]) == result["structuredContent"]
    return result["structuredContent"]


def portal():
    app = FastAPI()
    for router in (treinos.router, templates.router, rotinas.router):
        app.include_router(router)
    app.dependency_overrides[get_current_personal_id] = lambda: P
    return TestClient(app)


def large_program():
    return {"version": "1", "treinos": [{"nome": "Programa grande", "exercicios": [
        {"nome": f"Exercício {i}", "series_prescritas": [{"series": 3, "reps": "10"}]}
        for i in range(110)]}]}


def test_export_e_guia_no_formato_publicado(env):
    result = payload(call("exportar_programa_treino", {"aluno_id": A, "incluir_contexto": False}))
    assert result["version"] == "1" and "revisao" not in result
    guia = call("guia_de_prescricao", {})["content"][0]["text"]
    assert "aplicar_programa_treino" in guia and "salvar_proposta_programa" not in guia


def test_tool_aceita_programa_grande_e_e_idempotente(env):
    args = {"aluno_id": A, "programa": large_program(), "resumo_da_mudanca": "Teste"}
    first = payload(call("aplicar_programa_treino", args))
    assert first["status"] == "aplicado" and first["exercicios"] == 110
    assert payload(call("aplicar_programa_treino", args))["status"] == "ja_aplicado"
    assert len(env.query_pk(keys.pk_aluno(A), "EX#")) == 110


def test_import_do_portal_aceita_programa_grande(env):
    result = portal().post(f"/v1/alunos/{A}/treinos/importar", json={"conteudo": json.dumps(large_program())})
    assert result.status_code == 201, result.text
    assert result.json()["exercicios_importados"] == 110


def test_import_do_portal_tolera_revisao_base_enviada_pelo_front(env):
    """O front publicado ainda manda `revisao_base`; o router de produção ignora o campo."""
    body = {"conteudo": json.dumps(PROGRAM), "confirmar": False, "revisao_base": 3}
    result = portal().post(f"/v1/alunos/{A}/treinos/importar", json=body)
    assert result.status_code == 201, result.text


def test_desfazer_restaura_snapshot(env):
    ts = "2026-09-30T12:00:00+00:00"
    env.put_item(keys.pk_aluno(A), keys.sk_mcp_snap(ts), {
        "ts": ts, "programa": json.dumps(PROGRAM), "tool": "aplicar_programa_treino",
        "client_name": "ChatGPT", "ttl": int(time.time()) + 3600})
    result = payload(call("desfazer_alteracao_treino", {"aluno_id": A}))
    assert result["status"] == "restaurado" and result["de"] == ts
    assert [t["nome"] for t in env.query_pk(keys.pk_aluno(A), "TREINO#")] == ["Programa anterior"]
    assert mcp_service.ultimo_snapshot(A) is None


def test_crud_e_templates_do_portal(env):
    client = portal()
    made = client.post(f"/v1/alunos/{A}/treinos", json={"nome": "Treino do portal"})
    assert made.status_code == 201, made.text
    tid = made.json()["treino_id"]
    assert client.put(f"/v1/alunos/{A}/treinos/{tid}", json={"nome": "Editado"}).status_code == 200
    assert client.post(f"/v1/alunos/{A}/treinos/{tid}/exercicios", json={"nome": "Supino"}).status_code == 201
    template = client.post("/v1/templates/from-treino", json={"aluno_id": A, "treino_id": tid, "nome": "Modelo"})
    assert template.status_code == 201, template.text
    applied = client.post(f"/v1/templates/{template.json()['template_id']}/aplicar", json={"aluno_ids": [A]})
    assert applied.status_code == 200, applied.text


def test_tool_recusa_outro_tenant_sem_gravar(env):
    other = tokens.Tenant(personal_id="other", conn_id="c", client_name="ChatGPT", jti="x", scopes=TENANT.scopes)
    before = dict(env.itens)
    result = call("aplicar_programa_treino", {"aluno_id": A, "programa": PROGRAM, "resumo_da_mudanca": "x"}, other)
    assert result["isError"] and "não encontrado" in result["content"][0]["text"]
    assert env.itens == before


def test_sessao_ativa_exige_confirmacao_no_import(env):
    env.put_item(keys.pk_aluno(A), keys.SK_SESSION_ACTIVE,
        {"treino_id": "current", "treino_nome": "Treino em andamento", "desde": "2026-09-30"})
    client = portal()
    body = {"conteudo": json.dumps(PROGRAM)}
    assert client.post(f"/v1/alunos/{A}/treinos/importar", json=body).status_code == 409
    assert not env.query_pk(keys.pk_aluno(A), "TREINO#")
    body["confirmar"] = True
    assert client.post(f"/v1/alunos/{A}/treinos/importar", json=body).status_code == 201


def test_aplicar_rotina(env):
    env.put_item(keys.pk_personal(P), keys.sk_rotina("r"), {
        "rotina_id": "r", "nome": "Rotina", "personal_id": P, "created_at": "2026-09-30",
        "treinos": [{"nome": "A", "ordem": 0,
            "exercicios": [{"nome": "Supino", "series_prescritas": [{"series": 3, "reps": "10"}]}]}]})
    response = portal().post("/v1/rotinas/r/aplicar", json={"aluno_ids": [A], "modo": "substituir"})
    assert response.status_code == 200, response.text
    assert len(env.query_pk(keys.pk_aluno(A), "TREINO#")) == 1


def test_detalhar_aluno_entrega_anamnese_legivel(env):
    """BOOL/lista da anamnese chegavam ao LLM como "False" e "['a', 'b']"."""
    env.put_item(keys.pk_aluno(A), keys.SK_ANAMNESE_ALUNO, {"preenchido_em": "2026-09-29",
        "respostas": {"fumante": False, "locais": ["Academia", "Em casa"]}})
    ctx = payload(call("detalhar_aluno", {"aluno_id": A}))["contexto_aluno"]
    assert {r["resposta"] for r in ctx["anamnese"]["respostas"]} == {"Não", "Academia, Em casa"}
