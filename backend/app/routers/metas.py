"""Metas / objetivos do aluno — portal (personal) e app (aluno)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.models.meta import MetaCreate, MetaUpdate
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz, meta_service

router = APIRouter(tags=["metas"])


class StatusBody(BaseModel):
    status: str   # APROVADA | CANCELADA


# ── Portal (personal) ────────────────────────────────────────────────────────

@router.get("/v1/alunos/{aluno_id}/metas")
def list_metas_portal(aluno_id: str, status: str | None = None,
                      personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return meta_service.listar(aluno_id, status=status)


@router.post("/v1/alunos/{aluno_id}/metas", status_code=201)
def create_meta_portal(aluno_id: str, body: MetaCreate,
                       personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    if body.tipo == "CARGA" and not body.exercicio_id:
        raise HTTPException(400, "exercicio_id obrigatório para metas do tipo CARGA")
    if body.tipo == "MEDIDA" and not body.campo_medida:
        raise HTTPException(400, "campo_medida obrigatório para metas do tipo MEDIDA")
    return meta_service.criar(aluno_id, personal_id, body.model_dump(), criado_por="PERSONAL")


@router.put("/v1/alunos/{aluno_id}/metas/{ts_id}")
def update_meta_portal(aluno_id: str, ts_id: str, body: MetaUpdate,
                       personal_id: str = Depends(get_current_personal_id)):
    """ts_id = '{ts}#{meta_id}'"""
    authz.authorize_aluno(personal_id, aluno_id)
    parts = ts_id.split("#", 1)
    if len(parts) != 2:
        raise HTTPException(400, "ts_id inválido")
    updated = meta_service.atualizar(aluno_id, parts[0], parts[1], body.model_dump(exclude_none=True))
    if updated is None:
        raise HTTPException(404, "Meta não encontrada")
    return updated


@router.patch("/v1/alunos/{aluno_id}/metas/{ts_id}/status")
def alterar_status_portal(aluno_id: str, ts_id: str, body: StatusBody,
                           personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    if body.status not in ("APROVADA", "CANCELADA", "CONCLUIDA"):
        raise HTTPException(400, "Status inválido")
    parts = ts_id.split("#", 1)
    updated = meta_service.alterar_status(aluno_id, parts[0], parts[1], body.status)
    if updated is None:
        raise HTTPException(404, "Meta não encontrada")
    return updated


@router.delete("/v1/alunos/{aluno_id}/metas/{ts_id}", status_code=204)
def delete_meta_portal(aluno_id: str, ts_id: str,
                       personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    parts = ts_id.split("#", 1)
    meta_service.excluir(aluno_id, parts[0], parts[1])


@router.get("/v1/alunos/{aluno_id}/badges")
def listar_badges_portal(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    from app.services import badge_service
    return badge_service.listar_badges_aluno(aluno_id)
