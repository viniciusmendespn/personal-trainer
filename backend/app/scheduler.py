"""Lambda diária (EventBridge): processa vencimentos de treino, geração de cobranças
e transições de status financeiro. Agenda particionada por dia (`SCHED#{data}`)."""
import logging
from datetime import datetime, timedelta, timezone

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import financeiro_service, notif_service

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

_JANELA_DIAS = 30   # cobre entradas não processadas em execuções anteriores


def _processar_dia_treinos(data: str) -> int:
    n = 0
    cursor = None
    while True:
        items, cursor = repo.query_pk_page(keys.pk_sched(data), keys.DUE_PREFIX, limit=50, cursor=cursor)
        for it in items:
            # Delete first — atomic claim prevents duplicate notifications on Lambda retries
            if not repo.delete_item_if_exists(keys.pk_sched(data), it["SK"]):
                continue
            personal_id = it.get("personal_id")
            if personal_id:
                nome = it.get("aluno_nome") or "um aluno"
                tnome = it.get("treino_nome") or "Treino"
                notif_service.criar(
                    personal_id, "TREINO_FIM", "Treino chegou ao fim",
                    f"O treino '{tnome}' de {nome} venceu em {it.get('data_fim')}. "
                    f"Hora de renovar ou atualizar.", aluno_id=it.get("aluno_id"))
            n += 1
        if cursor is None:
            break
    return n


def _processar_dia_billing_gerar(data: str) -> int:
    """Gera cobranças agendadas para hoje."""
    n = 0
    cursor = None
    while True:
        items, cursor = repo.query_pk_page(
            keys.pk_sched(data), keys.BILLING_GERAR_PREFIX, limit=50, cursor=cursor)
        for it in items:
            if not repo.delete_item_if_exists(keys.pk_sched(data), it["SK"]):
                continue
            try:
                financeiro_service._gerar_cobranca_agendada(
                    it["aluno_id"], it["personal_id"], it["vencimento"])
            except Exception as exc:
                logger.error("[scheduler] billing_gerar falhou aluno=%s: %s", it.get("aluno_id"), exc)
            n += 1
        if cursor is None:
            break
    return n


def _processar_dia_billing_vencer(data: str) -> int:
    """Marca cobranças como VENCIDA quando a data de vencimento chega."""
    n = 0
    cursor = None
    while True:
        items, cursor = repo.query_pk_page(
            keys.pk_sched(data), keys.BILLING_VENCER_PREFIX, limit=50, cursor=cursor)
        for it in items:
            if not repo.delete_item_if_exists(keys.pk_sched(data), it["SK"]):
                continue
            try:
                financeiro_service._marcar_vencida(
                    it["aluno_id"], it["cobranca_id"], it["vencimento"], it["personal_id"])
            except Exception as exc:
                logger.error("[scheduler] billing_vencer falhou aluno=%s: %s", it.get("aluno_id"), exc)
            n += 1
        if cursor is None:
            break
    return n


def handler(event, context):
    hoje = datetime.now(timezone.utc).date()
    treinos_total = 0
    billing_gerar_total = 0
    billing_vencer_total = 0
    for i in range(_JANELA_DIAS, -1, -1):
        data = (hoje - timedelta(days=i)).isoformat()
        treinos_total += _processar_dia_treinos(data)
        billing_gerar_total += _processar_dia_billing_gerar(data)
        billing_vencer_total += _processar_dia_billing_vencer(data)
    logger.info(
        "[scheduler] treinos=%d billing_gerar=%d billing_vencer=%d",
        treinos_total, billing_gerar_total, billing_vencer_total,
    )
    return {
        "treinos": treinos_total,
        "billing_gerar": billing_gerar_total,
        "billing_vencer": billing_vencer_total,
    }
