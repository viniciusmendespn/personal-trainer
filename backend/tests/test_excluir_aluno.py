"""Excluir aluno não pode deixar rastro visível para o personal.

Origem: em produção um personal excluiu 11 alunos e continuou recebendo cobrança de
mensalidade deles, com "?" em "treino em andamento" no dashboard. O DELETE só apagava
perfil + ponteiro; config de cobrança, ATIVIDADE#, COBRANCA_ALUNO#, RANKING#, notificações
e entradas do scheduler ficavam vivos.
"""
import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_current_personal_id
from app.main import app
from app.repositories import keys
from app.services import financeiro_service

PERSONAL = "personal-1"
ALUNO = "aluno-1"
OUTRO = "aluno-2"
PT = keys.pk_personal(PERSONAL)


@pytest.fixture
def cliente(repo_fake, monkeypatch):
    monkeypatch.setattr(financeiro_service.locale_service, "tz_do_personal",
                        lambda _pid: "America/Sao_Paulo")
    for aid, nome in ((ALUNO, "Marina"), (OUTRO, "Paulo")):
        repo_fake.put_item(PT, keys.sk_aluno_pointer(aid), {"aluno_id": aid, "nome": nome})
        repo_fake.put_item(keys.pk_aluno(aid), keys.SK_PROFILE, {
            "aluno_id": aid, "nome": nome, "status": "ATIVO", "telefone": f"+55119{aid[-1]}",
            "objetivos": ["Hipertrofia"], "acesso_token": f"tok-{aid}"})
        repo_fake.put_item(keys.pk_phone(PERSONAL, f"+55119{aid[-1]}"), "PHONE", {"aluno_id": aid})
        repo_fake.put_item(f"TOKEN#tok-{aid}", "META", {"aluno_id": aid})
        repo_fake.put_item(PT, keys.sk_atividade(aid), {"aluno_id": aid, "status": "EM_ANDAMENTO"})
        repo_fake.put_item(PT, keys.sk_ranking_aluno(aid), {"aluno_id": aid, "total_pontos": 10})
        repo_fake.put_item(PT, keys.sk_notif("1", f"n-{aid}"), {"aluno_id": aid, "lida": False})
        repo_fake.put_item(keys.pk_aluno(aid), keys.sk_treino("t1"),
                           {"treino_id": f"t-{aid}", "data_fim": "2026-11-01"})
        repo_fake.put_item(keys.pk_sched("2026-11-01"), keys.sk_due(f"t-{aid}"), {"aluno_id": aid})
    repo_fake.put_item(PT, keys.SK_STATS_ALUNOS, {"total": 2, "ativos": 2})
    repo_fake.put_item(PT, keys.SK_STATS_NOTIF, {"nao_lidas": 2})

    # Mensalidade ativa só da Marina, com uma cobrança pendente já agendada.
    financeiro_service.set_config(PERSONAL, ALUNO, {
        "valor": 200, "recorrencia": "MENSAL", "dia_vencimento": 10, "ativo": True,
        "dias_antecedencia": 15})
    app.dependency_overrides[get_current_personal_id] = lambda: PERSONAL
    yield TestClient(app), repo_fake
    app.dependency_overrides.clear()


def _chaves(repo, pk: str) -> set[str]:
    return {i["SK"] for i in repo.query_pk(pk)}


def test_excluir_apaga_tudo_do_aluno(cliente):
    tc, repo = cliente
    sched_antes = {pk for pk, _ in repo._itens if pk.startswith("SCHED#")} \
        if hasattr(repo, "_itens") else set()

    assert tc.delete(f"/v1/alunos/{ALUNO}").status_code == 204

    assert _chaves(repo, keys.pk_aluno(ALUNO)) == set()
    assert not any(ALUNO in sk for sk in _chaves(repo, PT)), _chaves(repo, PT)
    assert repo.get_item(keys.pk_phone(PERSONAL, "+551191"), "PHONE") is None
    assert repo.get_item(f"TOKEN#tok-{ALUNO}", "META") is None
    assert repo.get_item(keys.pk_sched("2026-11-01"), keys.sk_due(f"t-{ALUNO}")) is None


def test_excluir_zera_financeiro_e_contadores(cliente):
    tc, repo = cliente
    assert financeiro_service.mrr(PERSONAL) == 200
    assert repo.get_item(PT, keys.SK_STATS_FIN_OPEN)["pendente_count"] == 1

    tc.delete(f"/v1/alunos/{ALUNO}")

    assert financeiro_service.mrr(PERSONAL) == 0
    aberto = repo.get_item(PT, keys.SK_STATS_FIN_OPEN)
    assert aberto["pendente_count"] == 0 and aberto["pendente_valor"] == 0
    stats = repo.get_item(PT, keys.SK_STATS_ALUNOS)
    assert (stats["total"], stats["ativos"]) == (1, 1)
    assert repo.get_item(PT, keys.SK_STATS_NOTIF)["nao_lidas"] == 1


def test_scheduler_nao_gera_cobranca_de_aluno_excluido(cliente):
    tc, repo = cliente
    tc.delete(f"/v1/alunos/{ALUNO}")

    # A entrada BILLING_GERAR# não tem data guardada; se disparar, tem de ser no-op.
    financeiro_service._gerar_cobranca_agendada(ALUNO, PERSONAL, "2026-12-10")

    assert _chaves(repo, keys.pk_aluno(ALUNO)) == set()
    assert financeiro_service.mrr(PERSONAL) == 0


def test_outro_aluno_fica_intacto(cliente):
    tc, repo = cliente
    antes = _chaves(repo, keys.pk_aluno(OUTRO))

    tc.delete(f"/v1/alunos/{ALUNO}")

    assert _chaves(repo, keys.pk_aluno(OUTRO)) == antes
    pt = _chaves(repo, PT)
    for sk in (keys.sk_aluno_pointer(OUTRO), keys.sk_atividade(OUTRO),
               keys.sk_ranking_aluno(OUTRO), keys.sk_notif("1", f"n-{OUTRO}")):
        assert sk in pt
    assert repo.get_item(keys.pk_sched("2026-11-01"), keys.sk_due(f"t-{OUTRO}"))
