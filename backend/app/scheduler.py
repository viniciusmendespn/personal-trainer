"""Lambda diária (EventBridge): processa vencimentos de treino e notifica o personal.
Lê a agenda global SYSTEM#SCHED por intervalo de data (sem scan)."""
import logging
from datetime import datetime, timezone

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import notif_service

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def handler(event, context):
    hoje = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # DUE# com data_fim <= hoje (vencidos ou vencendo hoje)
    hi = keys.DUE_PREFIX + hoje + "￿"
    items = repo.query_between(keys.PK_SCHED, keys.DUE_PREFIX, hi)
    for it in items:
        # Delete first — atomic claim prevents duplicate notifications on Lambda retries
        if not repo.delete_item_if_exists(keys.PK_SCHED, it["SK"]):
            continue
        personal_id = it.get("personal_id")
        if personal_id:
            nome = it.get("aluno_nome") or "um aluno"
            tnome = it.get("treino_nome") or "Treino"
            notif_service.criar(
                personal_id, "TREINO_FIM", "Treino chegou ao fim",
                f"O treino '{tnome}' de {nome} venceu em {it.get('data_fim')}. "
                f"Hora de renovar ou atualizar.", aluno_id=it.get("aluno_id"))
    logger.info("[scheduler] %d vencimento(s) notificado(s)", len(items))
    return {"processed": len(items)}
