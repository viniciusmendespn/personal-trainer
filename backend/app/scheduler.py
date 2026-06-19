"""Lambda diária (EventBridge): processa vencimentos de treino e notifica o personal.
Agenda particionada por dia (`SCHED#{data_fim}`, ESPEC §2.1) — evita hot-partition global.
Varre uma janela retroativa (cobre vencidos não processados por qualquer motivo) + hoje,
paginando cada partição diária até o fim."""
import logging
from datetime import datetime, timedelta, timezone

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import notif_service

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

_JANELA_DIAS = 30   # cobre vencimentos não processados em execuções anteriores


def _processar_dia(data: str) -> int:
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


def handler(event, context):
    hoje = datetime.now(timezone.utc).date()
    total = 0
    for i in range(_JANELA_DIAS, -1, -1):
        data = (hoje - timedelta(days=i)).isoformat()
        total += _processar_dia(data)
    logger.info("[scheduler] %d vencimento(s) notificado(s)", total)
    return {"processed": total}
