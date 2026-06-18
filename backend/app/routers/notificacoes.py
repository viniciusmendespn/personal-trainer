"""Sistema de notificações do portal — notificações unificadas (dor, treino, mídia, etc)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_personal_id
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import alerta_service, anotif_service, authz, media_service, notif_service
from app.utils import new_id, now_iso

router = APIRouter(prefix="/v1", tags=["notificacoes"])


class Ref:
    def __init__(self, ref: str):
        self.ref = ref


from pydantic import BaseModel


class RefBody(BaseModel):
    ref: str


class ResponderBody(BaseModel):
    ref: str       # SK da notificação (para buscar relato_sk e marcar como lida)
    texto: str
    aluno_id: str


# ── Notificações ─────────────────────────────────────────────────────────────
@router.get("/notificacoes")
def listar(limit: int = 50, cursor: str | None = None, tipo: str | None = None,
           personal_id: str = Depends(get_current_personal_id)):
    items, next_cursor = notif_service.listar(personal_id, limit, cursor, tipo)
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


@router.get("/notificacoes/relato")
def get_relato(ref: str, aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Retorna o item de dor ou dúvida vinculado a uma notificação, incluindo a thread de comentários."""
    authz.authorize_aluno(personal_id, aluno_id)
    notif = repo.get_item(keys.pk_personal(personal_id), ref)
    if not notif:
        raise HTTPException(404, "Notificação não encontrada")
    relato_sk = notif.get("relato_sk")
    if not relato_sk:
        raise HTTPException(400, "Notificação sem relato vinculado")
    relato = repo.get_item(keys.pk_aluno(aluno_id), relato_sk)
    if not relato:
        raise HTTPException(404, "Relato não encontrado")
    return {**repo.clean(relato), "relato_sk": relato_sk}


class ComentarBody(BaseModel):
    ref: str
    texto: str
    aluno_id: str


@router.post("/notificacoes/comentar")
def comentar_notif(body: ComentarBody, personal_id: str = Depends(get_current_personal_id)):
    """Personal adiciona comentário em uma thread de dor ou dúvida via notificação."""
    authz.authorize_aluno(personal_id, body.aluno_id)
    notif = repo.get_item(keys.pk_personal(personal_id), body.ref)
    if not notif:
        raise HTTPException(404, "Notificação não encontrada")
    relato_sk = notif.get("relato_sk")
    if not relato_sk:
        raise HTTPException(400, "Esta notificação não tem relato vinculado")
    ok = alerta_service.adicionar_comentario(body.aluno_id, relato_sk, "PERSONAL", body.texto)
    if not ok:
        raise HTTPException(404, "Relato não encontrado")
    exercicio_id = notif.get("exercicio_id")
    tipo_notif = "DOR_RESPONDIDA" if relato_sk.startswith("DOR#") else "DUVIDA_RESPONDIDA"
    anotif_service.criar(body.aluno_id, tipo_notif, "Resposta do seu personal",
                         body.texto[:120] + ("…" if len(body.texto) > 120 else ""),
                         ref_extra={"exercicio_id": exercicio_id, "relato_sk": relato_sk})
    return {"ok": True}


@router.post("/notificacoes/responder")
def responder_notif(body: ResponderBody, personal_id: str = Depends(get_current_personal_id)):
    """Personal responde a um relato de dor ou dúvida do aluno.
    A notificação deve conter relato_sk e relato_tipo nos campos extras."""
    authz.authorize_aluno(personal_id, body.aluno_id)
    # Busca a notificação para obter a SK do relato original
    notif = repo.get_item(keys.pk_personal(personal_id), body.ref)
    if not notif:
        raise HTTPException(404, "Notificação não encontrada")
    relato_sk = notif.get("relato_sk")
    if not relato_sk:
        raise HTTPException(400, "Esta notificação não tem relato vinculado para responder")
    ok = alerta_service.responder_relato(body.aluno_id, relato_sk, body.texto, personal_id)
    if not ok:
        raise HTTPException(404, "Relato não encontrado")
    notif_service.marcar_lida(personal_id, body.ref)
    return {"ok": True}


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
