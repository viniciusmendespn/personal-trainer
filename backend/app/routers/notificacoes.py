"""Sistema de notificações do portal + pendências (ESPEC §2.2)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.services import alerta_service, notif_service

router = APIRouter(prefix="/v1", tags=["notificacoes"])


class Ref(BaseModel):
    ref: str


# ── Notificações ─────────────────────────────────────────────────────────────
@router.get("/notificacoes")
def listar(personal_id: str = Depends(get_current_personal_id)):
    return notif_service.listar(personal_id)


@router.get("/notificacoes/unread")
def unread(personal_id: str = Depends(get_current_personal_id)):
    return {"count": notif_service.nao_lidas(personal_id)}


@router.post("/notificacoes/read")
def read(body: Ref, personal_id: str = Depends(get_current_personal_id)):
    notif_service.marcar_lida(personal_id, body.ref)
    return {"ok": True}


@router.post("/notificacoes/read-all")
def read_all(personal_id: str = Depends(get_current_personal_id)):
    return {"marcadas": notif_service.marcar_todas(personal_id)}


# ── Pendências ───────────────────────────────────────────────────────────────
@router.get("/pendencias")
def list_pendencias(personal_id: str = Depends(get_current_personal_id)):
    return alerta_service.list_pendencias(personal_id)


@router.post("/pendencias/resolve")
def resolve_pendencia(body: Ref, personal_id: str = Depends(get_current_personal_id)):
    alerta_service.resolve_pendencia(personal_id, body.ref)
    return {"ok": True}
