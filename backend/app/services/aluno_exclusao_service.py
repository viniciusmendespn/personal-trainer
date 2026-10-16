"""Exclusão de aluno: apaga o aluno e TUDO que aponta para ele.

Antes, o DELETE só removia perfil + ponteiro e deixava para trás os itens denormalizados
na partição do personal e as entradas do scheduler. Em produção (personal com 11 alunos
excluídos) isso aparecia como:
  - mensalidades continuando a ser geradas/notificadas (COBRANCA_CONFIG e BILLING_* vivos);
  - "?" na atividade recente do dashboard (ATIVIDADE# sem perfil, preso em "em andamento");
  - MRR/recebíveis somando aluno que não existe (COBRANCA_ALUNO# + STATS#FINOPEN);
  - aluno fantasma no ranking e nas notificações.

Mapa do que um aluno deixa espalhado:
  AL#{aluno}            → tudo dele (perfil, treinos, sessões, cobranças, pontos...) — apaga inteira
  PT#{personal}         → ALUNO#, ATIVIDADE#, COBRANCA_ALUNO#, RANKING#, NOTIF# e AGENDA# dele
  PHONE#/TOKEN#         → lookups globais
  SCHED#{dia}           → DUE# (treino), BILLING_* (cobranças em aberto), AGENDA_NOTIF#
Recebido no mês (STATS#FINM#) fica: é dinheiro que de fato entrou no caixa do personal.
Entrada de scheduler que escapar daqui (ex.: BILLING_GERAR#, cuja data não é guardada) vira
no-op — todo handler relê o item em AL# antes de agir, e a partição não existe mais.
"""
import logging

from app.models.enums import AlunoStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import agenda_notif_service, assinatura_service, authz, financeiro_service

logger = logging.getLogger(__name__)

_ABERTAS = ("PENDENTE", "VENCIDA")


def excluir(personal_id: str, aluno_id: str) -> None:
    pk_pt, pk_al = keys.pk_personal(personal_id), keys.pk_aluno(aluno_id)
    itens_al = repo.query_pk(pk_al)
    perfil = next((i for i in itens_al if i["SK"] == keys.SK_PROFILE), None)

    deletes: list[tuple[str, str]] = []

    # ── Lookups globais ──────────────────────────────────────────────────────
    if perfil and perfil.get("telefone"):
        deletes.append((keys.pk_phone(personal_id, perfil["telefone"]), "PHONE"))
    if perfil and perfil.get("acesso_token"):
        deletes.append((f"TOKEN#{perfil['acesso_token']}", "META"))

    # ── Scheduler e financeiro, a partir do que existe em AL# ────────────────
    for it in itens_al:
        sk = it["SK"]
        if sk.startswith(keys.SK_TREINO_PREFIX) and it.get("data_fim") and it.get("treino_id"):
            deletes.append((keys.pk_sched(it["data_fim"]), keys.sk_due(it["treino_id"])))
        elif (sk.startswith(keys.COBRANCA_PREFIX) and it.get("personal_id") == personal_id
              and it.get("status") in _ABERTAS):
            # Estorna o recebível do snapshot (o ponteiro por aluno some logo abaixo) e
            # cancela aviso/vencer/lembretes desta cobrança.
            valor = float(it.get("valor", 0) or 0)
            balde = "vencido" if it["status"] == "VENCIDA" else "pendente"
            repo.add_and_set(pk_pt, keys.SK_STATS_FIN_OPEN,
                             add={f"{balde}_valor": -valor, f"{balde}_count": -1})
            financeiro_service._cancelar_agendamentos_billing(
                aluno_id, it.get("cobranca_id"), it.get("vencimento"))

    # ── Partição do personal ─────────────────────────────────────────────────
    for sk in (keys.sk_aluno_pointer(aluno_id), keys.sk_atividade(aluno_id),
               keys.sk_cobranca_aluno(aluno_id), keys.sk_ranking_aluno(aluno_id)):
        deletes.append((pk_pt, sk))

    nao_lidas = 0
    for n in repo.query_pk(pk_pt, sk_prefix=keys.NOTIF_PREFIX):
        if n.get("aluno_id") == aluno_id:
            deletes.append((pk_pt, n["SK"]))
            nao_lidas += 0 if n.get("lida") else 1
    if nao_lidas:
        repo.add_and_set(pk_pt, keys.SK_STATS_NOTIF, add={"nao_lidas": -nao_lidas})

    for ag in repo.query_pk(pk_pt, sk_prefix=keys.AGENDA_PREFIX):
        if ag.get("aluno_id") == aluno_id:
            deletes.append((pk_pt, ag["SK"]))
            if ag.get("agendamento_id") and ag.get("data_hora_inicio"):
                agenda_notif_service.cancelar(ag)

    # ── Partição do aluno, inteira ───────────────────────────────────────────
    deletes.extend((pk_al, it["SK"]) for it in itens_al)
    repo.batch_write(deletes=deletes)

    # ── Agregados e caches ───────────────────────────────────────────────────
    if perfil:
        decremento = {"total": -1}
        if perfil.get("status") == AlunoStatus.ATIVO:
            decremento["ativos"] = -1
        repo.add_and_set(pk_pt, keys.SK_STATS_ALUNOS, add=decremento)
        # Legado: `objetivo` (str) antes de `objetivos` (list) — mesma regra do router.
        objetivos = (perfil.get("objetivos") or [] if "objetivos" in perfil
                     else [perfil["objetivo"]] if perfil.get("objetivo") else [])
        for obj in objetivos:
            repo.add_and_set(pk_pt, keys.SK_STATS_OBJETIVOS,
                             add={keys.normalize_objetivo(obj): -1})
    authz.invalidate(personal_id, aluno_id)
    assinatura_service.invalidate_alunos_bloqueados(personal_id)
    logger.info("[aluno] excluído personal=%s aluno=%s itens=%d",
                personal_id, aluno_id, len(deletes))
