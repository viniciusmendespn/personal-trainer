"""Perfil do personal trainer: foto, nome, descrição e campos biográficos."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import media_service
from app.utils import now_iso

router = APIRouter(prefix="/v1/personal", tags=["personal"])


class PersonalProfileUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None            # tagline curta
    biografia: Optional[str] = None
    experiencia_profissional: Optional[str] = None
    formacao: Optional[str] = None
    foto_s3_key: Optional[str] = None
    instagram_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    youtube_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    facebook_url: Optional[str] = None
    x_url: Optional[str] = None
    site_url: Optional[str] = None


class AvatarUploadUrlBody(BaseModel):
    filename: str
    content_type: str


def _add_foto_url(profile: dict) -> dict:
    s3_key = profile.get("foto_s3_key")
    if s3_key:
        profile["foto_url"] = media_service.gerar_presigned_view_url(s3_key)
    return profile


@router.get("/me")
def get_profile(personal_id: str = Depends(get_current_personal_id)):
    item = repo.get_item(keys.pk_personal(personal_id), keys.SK_PROFILE)
    if not item:
        return {"personal_id": personal_id}
    profile = repo.clean(item)
    return _add_foto_url(profile)


@router.put("/me")
def update_profile(body: PersonalProfileUpdate, personal_id: str = Depends(get_current_personal_id)):
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(400, "Nenhum campo informado")
    fields["updated_at"] = now_iso()
    updated = repo.update_item(keys.pk_personal(personal_id), keys.SK_PROFILE, fields, return_values=True)
    return _add_foto_url(repo.clean(updated))


@router.post("/me/avatar/upload-url")
def avatar_upload_url(body: AvatarUploadUrlBody, personal_id: str = Depends(get_current_personal_id)):
    result = media_service.gerar_presigned_upload_url_perfil(
        "personal", personal_id, body.filename, body.content_type
    )
    if not result:
        raise HTTPException(502, "Não foi possível gerar a URL de upload.")
    return result
