"""Agenda de compromissos do personal com alunos — partição PT# (baixo volume,
mesmo padrão de range query usado no scheduler para vencimentos)."""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_personal_id
from app.models.agendamento import Agendamento, AgendamentoCreate, AgendamentoUpdate
from app.models.enums import AgendamentoStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz
from app.utils import new_id, now_iso

router = APIRouter(prefix="/v1/agenda", tags=["agenda"])


@router.get("")
def list_agenda(
    de: str, ate: str, personal_id: str = Depends(get_current_personal_id)
):
    """`de`/`ate` são ISO8601 (ou apenas YYYY-MM-DD) — comparação lexicográfica funciona
    porque ISO8601 é ordenável como string."""
    items = repo.query_between(
        keys.pk_personal(personal_id), f"AGENDA#{de}", f"AGENDA#{ate}￿"
    )
    return repo.clean_all(items)


@router.post("", response_model=Agendamento, status_code=201)
def create_agendamento(
    body: AgendamentoCreate, personal_id: str = Depends(get_current_personal_id)
):
    authz.authorize_aluno(personal_id, body.aluno_id)
    ag = Agendamento(
        agendamento_id=new_id(),
        personal_id=personal_id,
        status=AgendamentoStatus.AGENDADO,
        created_at=now_iso(),
        **body.model_dump(),
    )
    repo.put_item(
        keys.pk_personal(personal_id),
        keys.sk_agenda(ag.data_hora_inicio, ag.agendamento_id),
        ag.model_dump(),
    )
    return ag


@router.put("/{ts_id}", response_model=Agendamento)
def update_agendamento(
    ts_id: str, body: AgendamentoUpdate, personal_id: str = Depends(get_current_personal_id)
):
    """`ts_id` = '{data_hora_inicio}#{agendamento_id}' (do SK)."""
    updated = repo.update_item_if_exists(
        keys.pk_personal(personal_id), f"AGENDA#{ts_id}", body.model_dump(exclude_none=True)
    )
    if updated is None:
        raise HTTPException(404, "Agendamento não encontrado")
    return Agendamento(**repo.clean(updated))


@router.post("/{ts_id}/status", response_model=Agendamento)
def set_status(
    ts_id: str, status: AgendamentoStatus, personal_id: str = Depends(get_current_personal_id)
):
    updated = repo.update_item_if_exists(
        keys.pk_personal(personal_id), f"AGENDA#{ts_id}", {"status": status.value}
    )
    if updated is None:
        raise HTTPException(404, "Agendamento não encontrado")
    return Agendamento(**repo.clean(updated))


@router.delete("/{ts_id}", status_code=204)
def delete_agendamento(ts_id: str, personal_id: str = Depends(get_current_personal_id)):
    ok = repo.delete_item_if_exists(keys.pk_personal(personal_id), f"AGENDA#{ts_id}")
    if not ok:
        raise HTTPException(404, "Agendamento não encontrado")
