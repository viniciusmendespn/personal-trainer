"""Férias / ausências do aluno — portal (personal). O app do aluno usa rotas próprias
em routers/aluno.py (/v1/aluno/ferias)."""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_personal_id
from app.models.ferias import FeriasCreate, FeriasUpdate
from app.services import authz, ferias_service

router = APIRouter(tags=["ferias"])


def _validar_datas(data_inicio: str | None, data_fim: str | None) -> None:
    if data_inicio and data_fim and data_fim < data_inicio:
        raise HTTPException(400, "data_fim não pode ser anterior a data_inicio")


def _split_ts_id(ts_id: str) -> tuple[str, str]:
    parts = ts_id.split("#", 1)
    if len(parts) != 2:
        raise HTTPException(400, "ts_id inválido")
    return parts[0], parts[1]


@router.get("/v1/alunos/{aluno_id}/ferias")
def list_ferias_portal(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return ferias_service.listar(aluno_id)


@router.post("/v1/alunos/{aluno_id}/ferias", status_code=201)
def create_ferias_portal(aluno_id: str, body: FeriasCreate,
                         personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    _validar_datas(body.data_inicio, body.data_fim)
    return ferias_service.criar(aluno_id, personal_id, body.model_dump(), criado_por="PERSONAL")


@router.put("/v1/alunos/{aluno_id}/ferias/{ts_id}")
def update_ferias_portal(aluno_id: str, ts_id: str, body: FeriasUpdate,
                         personal_id: str = Depends(get_current_personal_id)):
    """ts_id = '{ts}#{ferias_id}'"""
    authz.authorize_aluno(personal_id, aluno_id)
    _validar_datas(body.data_inicio, body.data_fim)
    ts, ferias_id = _split_ts_id(ts_id)
    updated = ferias_service.atualizar(aluno_id, ts, ferias_id, body.model_dump(exclude_none=True))
    if updated is None:
        raise HTTPException(404, "Período de férias não encontrado")
    return updated


@router.delete("/v1/alunos/{aluno_id}/ferias/{ts_id}", status_code=204)
def delete_ferias_portal(aluno_id: str, ts_id: str,
                         personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    ts, ferias_id = _split_ts_id(ts_id)
    if not ferias_service.excluir(aluno_id, ts, ferias_id):
        raise HTTPException(404, "Período de férias não encontrado")
