"""Sistema de notificações do portal + pendências (ESPEC §2.2) — e a Central
unificada que combina as duas em um único feed cronológico para o personal."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import alerta_service, authz, notif_service

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


class VincularMidiaBody(BaseModel):
    ref: str            # SK da pendência (igual ao usado em /pendencias/resolve)
    aluno_id: str
    midia_id: str
    exercicio_id: str
    exercicio_nome: Optional[str] = None


@router.post("/pendencias/vincular-exercicio")
def vincular_exercicio_midia(body: VincularMidiaBody, personal_id: str = Depends(get_current_personal_id)):
    """Vincula uma mídia pendente (recebida sem exercício) a um exercício e resolve
    a pendência. A mídia muda de partição lógica (o exercicio_id faz parte da SK),
    então é um put do novo item + delete do antigo, num único lote."""
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
    alerta_service.resolve_pendencia(personal_id, body.ref)
    return {"ok": True}


# ── Central unificada (notificações + pendências, ordenado por data) ────────
@router.get("/central")
def central(personal_id: str = Depends(get_current_personal_id)):
    notifs = notif_service.listar(personal_id)
    pendencias = alerta_service.list_pendencias(personal_id)
    unread_notifs = [n for n in notifs if not n.get("lida")]
    items = sorted(
        [{**n, "kind": "NOTIF"} for n in unread_notifs] + [{**p, "kind": "PENDENCIA"} for p in pendencias],
        key=lambda x: x.get("data_hora", ""),
        reverse=True,
    )
    return {"items": items, "total": len(unread_notifs) + len(pendencias)}
