"""Feed global do personal — posts visíveis para todos os alunos vinculados."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.models.feed_global import PostGlobalCreate
from app.services import feed_global_service, media_service, pontos_service
from app.repositories import dynamo_repo as repo, keys

router = APIRouter(prefix="/v1/feed", tags=["feed-global"])


@router.get("")
def listar_feed(limit: int = 20, cursor: str | None = None,
                personal_id: str = Depends(get_current_personal_id)):
    items, next_cursor = feed_global_service.listar_posts_global(personal_id, limit=limit, cursor=cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.post("", status_code=201)
def criar_post(body: PostGlobalCreate, personal_id: str = Depends(get_current_personal_id)):
    midias = [m.model_dump() for m in body.midias]
    item = feed_global_service.criar_post_global(personal_id, body.tipo.value, body.texto, midias)
    return {"ok": 1, "post_id": item["post_id"]}


class MidiaUploadUrlBody(BaseModel):
    filename: str
    content_type: str


@router.post("/midia/upload-url")
def feed_midia_upload_url(body: MidiaUploadUrlBody, personal_id: str = Depends(get_current_personal_id)):
    result = media_service.gerar_presigned_upload_url(personal_id, body.filename, body.content_type)
    if not result:
        raise HTTPException(502, "Não foi possível gerar a URL de upload.")
    return result


@router.delete("/{post_id}", status_code=204)
def deletar_post(post_id: str, personal_id: str = Depends(get_current_personal_id)):
    found = feed_global_service.deletar_post(personal_id, post_id)
    if not found:
        raise HTTPException(404, "Post não encontrado")


@router.get("/ranking")
def ranking(personal_id: str = Depends(get_current_personal_id)):
    return pontos_service.get_ranking(personal_id)
