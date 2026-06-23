"""Lambda a cada 5 min (EventBridge): envia lembretes 15 min antes de cada evento."""
import logging
from datetime import datetime, timedelta, timezone

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import agenda_notif_service

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def handler(event, context):
    now = datetime.now(timezone.utc)
    start_dt = now - timedelta(minutes=2)
    end_dt = now + timedelta(minutes=6)
    start_iso = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_iso = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Duas datas cobre cruzamento de meia-noite sem queries desnecessárias
    dates = {start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")}

    total = 0
    for date in dates:
        items = repo.query_between(
            keys.pk_sched(date),
            f"{keys.AGENDA_NOTIF_PREFIX}{start_iso}",
            f"{keys.AGENDA_NOTIF_PREFIX}{end_iso}",
        )
        for it in items:
            if not repo.delete_item_if_exists(keys.pk_sched(date), it["SK"]):
                continue
            try:
                agenda_notif_service.enviar_lembrete(repo.clean(it))
            except Exception as exc:
                logger.error("[agenda-notif] falhou agendamento=%s: %s", it.get("agendamento_id"), exc)
            total += 1

    logger.info("[agenda-notif] lembretes=%d", total)
    return {"lembretes": total}
