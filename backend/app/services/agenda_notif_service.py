"""Lembretes de agenda — grava itens SCHED# 15 min antes do evento e os dispara."""
import logging
from datetime import datetime, timedelta, timezone

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import anotif_service, notif_service

logger = logging.getLogger(__name__)

_ANTECIPACAO_MIN = 15


def _notif_dt(data_hora_inicio: str) -> datetime:
    return (
        datetime.fromisoformat(data_hora_inicio.replace("Z", "+00:00"))
        - timedelta(minutes=_ANTECIPACAO_MIN)
    )


def registrar(agendamento: dict) -> None:
    """Cria item SCHED para disparo 15 min antes do evento."""
    notif_dt = _notif_dt(agendamento["data_hora_inicio"])
    if notif_dt <= datetime.now(timezone.utc):
        return
    notif_iso = notif_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    repo.put_item(
        keys.pk_sched(notif_iso[:10]),
        keys.sk_agenda_notif(notif_iso, agendamento["agendamento_id"]),
        {
            "agendamento_id": agendamento["agendamento_id"],
            "personal_id": agendamento["personal_id"],
            "aluno_id": agendamento["aluno_id"],
            "data_hora_inicio": agendamento["data_hora_inicio"],
        },
    )


def cancelar(agendamento: dict) -> None:
    """Remove item SCHED (evento cancelado, deletado ou reagendado)."""
    notif_dt = _notif_dt(agendamento["data_hora_inicio"])
    notif_iso = notif_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    repo.delete_item_if_exists(
        keys.pk_sched(notif_iso[:10]),
        keys.sk_agenda_notif(notif_iso, agendamento["agendamento_id"]),
    )


def enviar_lembrete(item: dict) -> None:
    """Chamado pelo agenda_scheduler — envia push para personal e aluno."""
    hora = item["data_hora_inicio"][11:16]
    anotif_service.criar(
        item["aluno_id"], "LEMBRETE_AULA",
        "Treino em 15 minutos!",
        f"Seu treino começa às {hora}. Prepare-se!",
    )
    notif_service.criar(
        item["personal_id"], "LEMBRETE_AULA",
        "Sessão em 15 minutos!",
        f"Sessão com aluno às {hora}.",
        aluno_id=item["aluno_id"],
    )
