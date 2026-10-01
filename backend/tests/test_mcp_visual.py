"""Contratos do workspace e garantias de escrita, com backend controlado."""
import json
import time
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.mcp import tools, ui_resources, tokens
from app.mcp.asgi import app
from app.repositories import dynamo_repo as repo, keys
from app.services import programa_commit_service as commits, programa_service, proposta_programa_service as propostas
from app.services import biblioteca_service, contexto_aluno_service

P, A = "personal-visual", "aluno-visual"
TENANT = tokens.Tenant(personal_id=P, conn_id="c", scopes=frozenset({tokens.SCOPE_READ, tokens.SCOPE_TREINOS_WRITE}), client_name="ChatGPT", jti="j")
NOVO = {"version": "1", "treinos": [{"nome": "Treino A", "exercicios": [
    {"nome": "Supino", "series_prescritas": [{"series": 3, "reps": "10", "carga": "20"}]}]}]}


@pytest.fixture
def visual(mcp_env, monkeypatch):
    monkeypatch.setattr(settings, "mcp_ui_enabled", True)
    monkeypatch.setattr(settings, "mcp_propostas_enabled", True)
    monkeypatch.setattr(settings, "mcp_aplicacao_enabled", True)
    mcp_env.put_item(keys.pk_personal(P), keys.sk_aluno_pointer(A), {"aluno_id": A, "nome": "Mariana", "status": "ATIVO", "vigencias": []})
    mcp_env.put_item(keys.pk_aluno(A), keys.SK_PROFILE, {"nome": "Mariana", "objetivos": ["Hipertrofia"]})
    return mcp_env


def call(name, arguments, tenant=TENANT):
    with tokens.usando_tenant(tenant):
        return tools.chamar_tool(name, arguments, tenant)


def draft(program=None):
    result = call("salvar_proposta_programa", {"aluno_id": A, "programa": program or NOVO,
        "resumo_da_mudanca": "Primeiro programa", "revisao_base": commits.revisao(A)})
    assert not result.get("isError"), result
    return result["_meta"]["coachpilot"]["proposta"]


def apply(p):
    return call("aplicar_proposta_programa", {"aluno_id": A, "proposta_id": p["proposta_id"], "revisao_proposta": p["revisao"]})


def test_resource_is_authenticated_and_self_contained(visual):
    visual.put_item(keys.pk_personal(P), keys.sk_mcp_conn("c"), {"scopes": list(TENANT.scopes), "client_name": "ChatGPT"})
    token, _ = tokens.emitir_access_token(P, "c", list(TENANT.scopes), "ChatGPT")
    client = TestClient(app)
    payload = {"jsonrpc": "2.0", "id": 1, "method": "resources/read", "params": {"uri": ui_resources.URI}}
    assert client.post("/mcp", json=payload).status_code == 401
    result = client.post("/mcp", json=payload, headers={"Authorization": f"Bearer {token}"}).json()["result"]
    resource = result["contents"][0]
    assert resource["mimeType"] == "text/html;profile=mcp-app"
    assert '<div id="root">' in resource["text"] and '<script type="module">' in resource["text"]
    assert '<script src=' not in resource["text"]
    assert resource["_meta"]["ui"]["csp"] == {"connectDomains": [], "resourceDomains": []}


def test_resource_disabled_preserves_text_tools(visual, monkeypatch):
    monkeypatch.setattr(settings, "mcp_ui_enabled", False)
    assert ui_resources.listar() == []
    descriptor = next(d for d in tools.listar_tools(TENANT) if d["name"] == "abrir_coachpilot")
    assert "_meta" not in descriptor
    assert 'Mariana' in call("abrir_coachpilot", {})["content"][0]["text"]


def test_ui_metadata_entrypoints_and_output_contract(visual):
    defs = {d["name"]: d for d in tools.listar_tools(TENANT)}
    assert defs["abrir_coachpilot"]["_meta"]["openai/ui"]["entrypoints"] == [{"type": "global"}, {"type": "thread"}]
    assert defs["salvar_proposta_programa"]["annotations"]["readOnlyHint"] is False
    result = call("mostrar_aluno", {"aluno_id": A})
    assert "contexto_aluno" not in result["structuredContent"]
    tools.WorkspaceOutput.model_validate(result["structuredContent"])
    assert result["_meta"]["coachpilot"]["contexto_aluno"]["perfil"]["nome"] == "Mariana"


def test_saving_and_editing_never_changes_active_program(visual):
    p = draft()
    assert commits.revisao(A) == 0 and visual.query_pk(keys.pk_aluno(A), "TREINO#") == []
    edited = deepcopy(p["programa"])
    edited["treinos"][0]["exercicios"][0]["series_prescritas"][0]["reps"] = "12"
    r = call("salvar_proposta_programa", {"aluno_id": A, "proposta_id": p["proposta_id"], "programa": edited,
        "resumo_da_mudanca": "Ajuste", "revisao_base": 0, "revisao_proposta": 1})
    assert r["structuredContent"]["revisao"] == 2
    assert apply(p)["isError"]
    assert commits.revisao(A) == 0


def test_apply_retry_returns_same_operation(visual):
    p = draft()
    first = apply(p)["structuredContent"]
    second = apply(p)["structuredContent"]
    assert first == second
    assert first["status"] == "aplicado" and commits.revisao(A) == 1
    assert len(visual.query_pk(keys.pk_aluno(A), keys.MCP_SNAP_PREFIX)) == 1
    assert len(visual.query_pk(keys.pk_personal(P), keys.MCP_AUDIT_PREFIX)) == 1
    assert len(visual.query_pk(keys.pk_personal(P), keys.NOTIF_PREFIX)) == 1


def test_portal_edit_invalidates_proposal_and_restore(visual):
    from app.models.treino_export import ProgramaTreinoFile
    programa_service.aplicar(P, A, ProgramaTreinoFile(**NOVO))
    p = draft()
    tid = visual.query_pk(keys.pk_aluno(A), "TREINO#")[0]["treino_id"]
    commits.atualizar(P, A, keys.sk_treino(tid), {"nome": "Portal mudou"}, base=1)
    assert apply(p)["isError"]
    assert commits.revisao(A) == 2
    assert propostas.obter(P, A, p["proposta_id"])["estado"] == "desatualizada"


def test_revision_condition_detects_race_inside_commit(visual, monkeypatch):
    p = draft()
    transaction = repo.transact_write
    def race(actions):
        visual.put_item(keys.pk_aluno(A), commits.REV_SK, {"revisao": 1})
        transaction(actions)
    monkeypatch.setattr(repo, "transact_write", race)
    result = apply(p)
    assert result["isError"] and result["_meta"]["erro"]["code"] == "REVISAO_DESATUALIZADA"
    assert visual.query_pk(keys.pk_aluno(A), "TREINO#") == []
    assert propostas.obter(P, A, p["proposta_id"])["estado"] == "desatualizada"


def test_failed_transaction_leaves_program_and_draft_intact(visual, monkeypatch):
    p = draft()
    before = deepcopy(visual.itens)
    monkeypatch.setattr(repo, "transact_write", lambda _: (_ for _ in ()).throw(RuntimeError("network")))
    with pytest.raises(RuntimeError): apply(p)
    assert visual.itens == before


def test_failed_derived_effect_is_recoverable_without_reapply(visual, monkeypatch):
    p = draft()
    real = biblioteca_service.upsert_from_exercicios
    monkeypatch.setattr(biblioteca_service, "upsert_from_exercicios", lambda *args: (_ for _ in ()).throw(RuntimeError("network")))
    result = apply(p)["structuredContent"]
    op = commits.obter_operacao(P, A, result["operation_id"])
    assert op["status"] == "aplicado" and "biblioteca" not in op.get("efeitos_concluidos", [])
    monkeypatch.setattr(biblioteca_service, "upsert_from_exercicios", real)
    call("retomar_operacao_programa", {"aluno_id": A, "operation_id": result["operation_id"]})
    assert "biblioteca" in commits.obter_operacao(P, A, result["operation_id"])["efeitos_concluidos"]
    assert commits.revisao(A) == 1


def test_expired_draft_is_blocked_even_before_ttl_cleanup(visual):
    p = draft()
    visual.update_item(keys.pk_personal(P), f"PROPOSTA#{p['proposta_id']}", {"expires_at": int(time.time()) - 1})
    assert apply(p)["isError"]
    assert commits.revisao(A) == 0


def test_invalid_prescription_is_saved_but_cannot_be_applied(visual):
    novo = deepcopy(NOVO)
    novo["treinos"][0]["exercicios"][0]["series_prescritas"][0]["series"] = 0
    p = draft(novo)
    assert p["estado"] == "invalida" and p["validacao"]["erros"]
    assert apply(p)["isError"]


def test_video_in_review_is_the_effective_video(visual):
    visual.put_item(keys.pk_personal(P), keys.sk_exlib("v"), {"nome": "Supino", "video_url": "https://www.youtube.com/watch?v=biblioteca"})
    novo = deepcopy(NOVO)
    novo["treinos"][0]["exercicios"][0]["video_url"] = "https://www.youtube.com/watch?v=ia"
    p = draft(novo)
    assert p["programa"]["treinos"][0]["exercicios"][0]["video_url"].endswith('biblioteca')
    visual.update_item(keys.pk_personal(P), keys.sk_exlib("v"), {"video_url": "https://www.youtube.com/watch?v=novo"})
    assert apply(p)["isError"]
    assert commits.revisao(A) == 0


def test_live_session_condition_is_checked_in_transaction(visual, monkeypatch):
    p = draft()
    transaction = repo.transact_write
    def race(actions):
        visual.put_item(keys.pk_aluno(A), keys.SK_SESSION_ACTIVE, {"treino_nome": "A", "status": "EM_ANDAMENTO"})
        transaction(actions)
    monkeypatch.setattr(repo, "transact_write", race)
    r = apply(p)
    assert r["isError"] and r["_meta"]["erro"]["code"] == "SESSAO_EM_ANDAMENTO"
    assert commits.revisao(A) == 0


def test_restore_exact_operation_and_protect_later_edits(visual):
    op = apply(draft())["structuredContent"]
    tid = visual.query_pk(keys.pk_aluno(A), "TREINO#")[0]["treino_id"]
    commits.atualizar(P, A, keys.sk_treino(tid), {"nome": "Mudança posterior"}, base=1)
    r = call("desfazer_alteracao_treino", {"aluno_id": A, "operation_id": op["operation_id"]})
    assert r["isError"] and commits.revisao(A) == 2
    assert visual.get_item(keys.pk_aluno(A), keys.sk_treino(tid))["nome"] == "Mudança posterior"


def test_restore_expired_snapshot(visual):
    op = apply(draft())["structuredContent"]
    visual.update_item(keys.pk_aluno(A), keys.sk_mcp_snap(op["aplicado_em"]), {"ttl": int(time.time()) - 1})
    assert call("desfazer_alteracao_treino", {"aluno_id": A, "operation_id": op["operation_id"]})["isError"]
    assert commits.revisao(A) == 1


def test_cross_tenant_and_cross_student_proposal_access(visual):
    p = draft()
    visual.put_item(keys.pk_personal(P), keys.sk_aluno_pointer("outro"), {"aluno_id": "outro"})
    assert call("obter_proposta_programa", {"aluno_id": "outro", "proposta_id": p["proposta_id"]})["isError"]
    other = tokens.Tenant(personal_id="outro-personal", conn_id="c", scopes=TENANT.scopes, client_name="x", jti="x")
    assert call("obter_proposta_programa", {"aluno_id": A, "proposta_id": p["proposta_id"]}, other)["isError"]


def test_read_only_cannot_save_apply_restore_or_resume(visual):
    p = draft()
    read = tokens.Tenant(personal_id=P, conn_id="read", scopes=frozenset({tokens.SCOPE_READ}), client_name="x", jti="x")
    for name, args in [
        ("salvar_proposta_programa", {"aluno_id": A, "programa": NOVO, "resumo_da_mudanca": "x", "revisao_base": 0}),
        ("aplicar_proposta_programa", {"aluno_id": A, "proposta_id": p["proposta_id"], "revisao_proposta": 1}),
        ("desfazer_alteracao_treino", {"aluno_id": A}),
        ("retomar_operacao_programa", {"aluno_id": A, "operation_id": "x"}),
    ]:
        assert call(name, args, read)["isError"]
    assert call("mostrar_aluno", {"aluno_id": A}, read)["structuredContent"]["somente_leitura"] is True


def test_search_accents_and_later_page(visual):
    visual.put_item(keys.pk_personal(P), keys.sk_aluno_pointer("zzz"), {"aluno_id": "zzz", "nome": "JOSÉ"})
    r = call("listar_alunos", {"busca": "jose", "limit": 1})["structuredContent"]
    assert [a["nome"] for a in r["items"]] == ["JOSÉ"]
    assert r["cobertura"]["alunos_examinados"] >= 2


def test_search_empty_partial_page_keeps_cursor(visual):
    for i in range(20):
        visual.put_item(keys.pk_personal(P), keys.sk_aluno_pointer(f"z{i:03}"), {"aluno_id": str(i), "nome": "Não combina"})
    r = call("listar_alunos", {"busca": "Ausente", "limit": 1})["structuredContent"]
    assert r["items"] == [] and r["next_cursor"] and not r["cobertura"]["completa"]


def test_context_failure_is_not_absence(visual, monkeypatch):
    monkeypatch.setattr(contexto_aluno_service, "_anamnese", lambda *a: (_ for _ in ()).throw(RuntimeError()))
    r = call("mostrar_aluno", {"aluno_id": A})["_meta"]["coachpilot"]["contexto_aluno"]
    assert r["anamnese"] is None and "anamnese" in r["secoes_indisponiveis"]
    assert r["notas_do_personal"] == [] and r["chat_recente"] == []


def test_diff_handles_duplicate_names_and_origin_ids():
    base = {"treinos": [{"nome": "A", "origem_id": "t1", "exercicios": [
        {"nome": "X", "origem_id": "e1"}, {"nome": "X", "origem_id": "e2"}]}]}
    proposta = deepcopy(base)
    proposta["treinos"][0]["exercicios"][1]["observacoes"] = "Ajuste"
    diff = propostas.diferencas(base, proposta)
    assert len(diff) == 1 and diff[0]["caminho"].endswith('exercicios[1].observacoes')
    for e in proposta["treinos"][0]["exercicios"]: e.pop("origem_id")
    tipos = [d["tipo"] for d in propostas.diferencas(base, proposta)]
    assert tipos.count("adicionado") == 2 and tipos.count("removido") == 2


def test_large_program_is_rejected_without_partial_writes(visual):
    novo = deepcopy(NOVO)
    novo["treinos"][0]["exercicios"] *= 100
    p = draft(novo)
    r = apply(p)
    assert r["isError"] and r["_meta"]["erro"]["code"] == "PROGRAMA_MUITO_GRANDE"
    assert commits.revisao(A) == 0 and visual.query_pk(keys.pk_aluno(A), "TREINO#") == []


def test_scheduler_retries_outbox_without_reapplying_program(visual, monkeypatch):
    from app import scheduler
    real = biblioteca_service.upsert_from_exercicios
    monkeypatch.setattr(biblioteca_service, "upsert_from_exercicios", lambda *args: (_ for _ in ()).throw(RuntimeError()))
    op = apply(draft())["structuredContent"]
    day = op["aplicado_em"][:10]
    assert visual.query_pk(keys.pk_sched(day), commits.PENDING_PREFIX)
    scheduler._processar_programas(day)
    assert visual.query_pk(keys.pk_sched(day), commits.PENDING_PREFIX)
    monkeypatch.setattr(biblioteca_service, "upsert_from_exercicios", real)
    scheduler._processar_programas(day)
    assert visual.query_pk(keys.pk_sched(day), commits.PENDING_PREFIX) == []
    assert commits.revisao(A) == 1
    assert len(visual.query_pk(keys.pk_personal(P), keys.NOTIF_PREFIX)) == 1


def test_retry_with_stale_library_query_does_not_overwrite_or_duplicate(visual, monkeypatch):
    biblioteca_service.upsert_from_exercicios(P, [{"nome": "Supino", "video_url": "https://example.test/a"}])
    item = visual.query_pk(keys.pk_personal(P), keys.EXLIB_PREFIX)[0]
    visual.update_item(item["PK"], item["SK"], {"video_url": "https://example.test/editado"})
    query = repo.query_pk
    monkeypatch.setattr(repo, "query_pk", lambda pk, sk_prefix=None, **kw: [] if sk_prefix == keys.EXLIB_PREFIX else query(pk, sk_prefix, **kw))
    biblioteca_service.upsert_from_exercicios(P, [{"nome": "SUPINO", "video_url": "https://example.test/a"}])
    result = visual.query_pk(keys.pk_personal(P), keys.EXLIB_PREFIX)
    assert len(result) == 1 and result[0]["video_url"].endswith("editado")


def test_delete_detects_session_started_during_transaction(visual, monkeypatch):
    from fastapi import HTTPException
    from app.routers import treinos
    visual.put_item(keys.pk_aluno(A), keys.sk_treino("t"), {"treino_id": "t", "nome": "A"})
    transaction = repo.transact_write
    def race(actions):
        visual.put_item(keys.pk_aluno(A), keys.SK_SESSION_ACTIVE, {"treino_id": "t", "status": "EM_ANDAMENTO"})
        transaction(actions)
    monkeypatch.setattr(repo, "transact_write", race)
    with pytest.raises(HTTPException) as error:
        treinos.delete_treino(A, "t", personal_id=P)
    assert error.value.detail["code"] == "SESSAO_EM_ANDAMENTO"
    assert commits.revisao(A) == 0 and visual.get_item(keys.pk_aluno(A), keys.sk_treino("t"))


def test_delete_can_leave_unrelated_active_session_intact(visual):
    from app.routers import treinos
    visual.put_item(keys.pk_aluno(A), keys.sk_treino("t"), {"treino_id": "t", "nome": "A"})
    visual.put_item(keys.pk_aluno(A), keys.SK_SESSION_ACTIVE, {"treino_id": "outro", "status": "EM_ANDAMENTO"})
    treinos.delete_treino(A, "t", personal_id=P)
    assert commits.revisao(A) == 1
    assert visual.get_item(keys.pk_aluno(A), keys.SK_SESSION_ACTIVE)["treino_id"] == "outro"


def test_old_agenda_effect_cannot_recreate_deleted_workout(visual, monkeypatch):
    from app.routers import treinos
    visual.put_item(keys.pk_aluno(A), keys.sk_treino("t"), {"treino_id": "t", "nome": "A", "data_fim": "2026-10-10"})
    transaction = repo.transact_write
    raced = False
    def race(actions):
        nonlocal raced
        if not raced:
            raced = True
            treinos.delete_treino(A, "t", personal_id=P)
        transaction(actions)
    monkeypatch.setattr(repo, "transact_write", race)
    with pytest.raises(repo.TransactionConflict):
        commits._agenda({"agenda": [[P, A, "t", "A", "2026-10-10"]]}, A, P)
    assert visual.get_item(keys.pk_sched("2026-10-10"), keys.sk_due("t")) is None


def test_evolution_retains_recorded_units_and_marks_legacy_unknown(visual):
    from app.services import sessao_service
    for i, unit in enumerate(["kg", "lb", None]):
        visual.put_item(keys.pk_aluno(A), f"REG#s#{i}", {"data_hora": "2026-09-30",
            "series_exec": [{"carga": 20, "reps": 10}], "unidade_carga": unit,
            "GSI1PK": keys.gsi1_registro(A, "supino"), "GSI1SK": str(i)})
    evo = sessao_service.evolucao_por_chave(A, "supino")
    assert [p["unidade_carga"] for p in evo["serie"]] == ["kg", "lb", None]


def test_library_change_between_validation_and_build_requires_new_review(visual, monkeypatch):
    p = draft()
    maps = iter([{}, {"supino": "https://example.test/video-novo"}])
    monkeypatch.setattr(biblioteca_service, "mapa_videos", lambda _: next(maps))
    r = apply(p)
    assert r["isError"] and "vídeo efetivo" in r["content"][0]["text"]
    assert commits.revisao(A) == 0


def test_applied_draft_with_collected_operation_returns_actionable_error(visual):
    p = draft()
    op = apply(p)["structuredContent"]
    visual.delete_item(keys.pk_personal(P), commits.op_sk(op["operation_id"]))
    r = apply(p)
    assert r["isError"] and "expirou" in r["content"][0]["text"]
    assert commits.revisao(A) == 1
