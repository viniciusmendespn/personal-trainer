"""Sistema de notificações do portal — notificações unificadas (dor, treino, mídia, etc)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_personal_id
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz, media_service, notif_service

router = APIRouter(prefix="/v1", tags=["notificacoes"])


class Ref:
    def __init__(self, ref: str):
        self.ref = ref


from pydantic import BaseModel


class RefBody(BaseModel):
    ref: str


# ── Notificações ─────────────────────────────────────────────────────────────
@router.get("/notificacoes")
def listar(limit: int = 50, cursor: str | None = None, personal_id: str = Depends(get_current_personal_id)):
    items, next_cursor = notif_service.listar(personal_id, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/notificacoes/item")
def get_notif(ref: str, personal_id: str = Depends(get_current_personal_id)):
    item = repo.get_item(keys.pk_personal(personal_id), ref)
    if not item:
        raise HTTPException(404, "Notificação não encontrada")
    return {**repo.clean(item), "ref": ref}


@router.delete("/notificacoes/item", status_code=204)
def delete_notif(ref: str, personal_id: str = Depends(get_current_personal_id)):
    ok = repo.delete_item_if_exists(keys.pk_personal(personal_id), ref)
    if not ok:
        raise HTTPException(404, "Notificação não encontrada")


@router.get("/notificacoes/unread")
def unread(personal_id: str = Depends(get_current_personal_id)):
    return {"count": notif_service.nao_lidas(personal_id)}


@router.post("/notificacoes/read")
def read(body: RefBody, personal_id: str = Depends(get_current_personal_id)):
    notif_service.marcar_lida(personal_id, body.ref)
    return {"ok": True}


@router.post("/notificacoes/read-all")
def read_all(personal_id: str = Depends(get_current_personal_id)):
    return {"marcadas": notif_service.marcar_todas(personal_id)}


# ── Ação: vincular mídia pendente a um exercício ─────────────────────────────
class VincularMidiaBody(BaseModel):
    ref: str            # SK da notificação MIDIA_PENDENTE (para marcar como lida)
    aluno_id: str
    midia_id: str
    exercicio_id: str
    exercicio_nome: Optional[str] = None


@router.post("/notificacoes/vincular-midia")
def vincular_midia(body: VincularMidiaBody, personal_id: str = Depends(get_current_personal_id)):
    """Vincula uma mídia recebida sem exercício a um exercício específico e marca a
    notificação como lida. Move o item de MIDIA#NA# para MIDIA#exercicio_id# no DynamoDB."""
    authz.authorize_aluno(personal_id, body.aluno_id)
    old_sk = f"MIDIA#NA#{body.midia_id}"
    item = repo.get_item(keys.pk_aluno(body.aluno_id), old_sk)
    if not item:
        raise HTTPException(404, "Mídia não encontrada")
    novo = {
        **repo.clean(item),
        "exercicio_id": body.exercicio_id,
        "exercicio_nome": body.exercicio_nome,
        "status": "VINCULADA",
    }
    new_sk = f"MIDIA#{body.exercicio_id}#{body.midia_id}"
    repo.batch_write(
        puts=[{"PK": keys.pk_aluno(body.aluno_id), "SK": new_sk, **novo}],
        deletes=[(keys.pk_aluno(body.aluno_id), old_sk)],
    )
    notif_service.marcar_lida(personal_id, body.ref)
    return {"ok": True}
