"""Alertas (dor) e pendências para o personal (ESPEC §2.2)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.services import alerta_service

router = APIRouter(prefix="/v1", tags=["alertas"])


class Ref(BaseModel):
    ref: str


@router.get("/alertas")
def list_alertas(personal_id: str = Depends(get_current_personal_id)):
    return alerta_service.list_alertas(personal_id)


@router.post("/alertas/resolve")
def resolve_alerta(body: Ref, personal_id: str = Depends(get_current_personal_id)):
    alerta_service.resolve_alerta(personal_id, body.ref)
    return {"ok": True}


@router.get("/pendencias")
def list_pendencias(personal_id: str = Depends(get_current_personal_id)):
    return alerta_service.list_pendencias(personal_id)


@router.post("/pendencias/resolve")
def resolve_pendencia(body: Ref, personal_id: str = Depends(get_current_personal_id)):
    alerta_service.resolve_pendencia(personal_id, body.ref)
    return {"ok": True}
