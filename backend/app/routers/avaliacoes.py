"""Avaliação física do aluno (peso, medidas, % gordura, fotos, bioimpedância) — partição AL#."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.models.avaliacao import Avaliacao, AvaliacaoCreate
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz, media_service
from app.utils import epoch_ms, new_id, now_iso

router = APIRouter(prefix="/v1/alunos/{aluno_id}/avaliacoes", tags=["avaliacoes"])


class UploadUrlBody(BaseModel):
    filename: str
    content_type: str


@router.post("/upload-url")
def upload_url(aluno_id: str, body: UploadUrlBody, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    result = media_service.gerar_presigned_upload_url(aluno_id, body.filename, body.content_type)
    if not result:
        raise HTTPException(502, "Não foi possível gerar a URL de upload.")
    return result


def _with_view_urls(item: dict) -> dict:
    c = repo.clean(item)
    c["fotos_urls"] = [u for u in (media_service.gerar_presigned_view_url(k) for k in c.get("fotos_s3_keys", [])) if u]
    if c.get("bio_scan_s3_key"):
        c["bio_scan_url"] = media_service.gerar_presigned_view_url(c["bio_scan_s3_key"])
    return c


@router.get("")
def list_avaliacoes(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.AVAL_PREFIX)
    return [_with_view_urls(i) for i in items]


@router.post("", response_model=Avaliacao, status_code=201)
def create_avaliacao(aluno_id: str, body: AvaliacaoCreate, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    now = now_iso()
    av = Avaliacao(avaliacao_id=new_id(), aluno_id=aluno_id, created_at=now,
                   **{**body.model_dump(), "data": body.data or now})
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_avaliacao(epoch_ms(), av.avaliacao_id), av.model_dump())
    return av


@router.delete("/{ts_id}", status_code=204)
def delete_avaliacao(aluno_id: str, ts_id: str, personal_id: str = Depends(get_current_personal_id)):
    """ts_id = '{ts}#{avaliacao_id}' (do SK)."""
    authz.authorize_aluno(personal_id, aluno_id)
    repo.delete_item(keys.pk_aluno(aluno_id), f"AVAL#{ts_id}")
