"""Perfil do personal trainer: foto, nome, descrição e campos biográficos."""
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import media_service
from app.utils import now_iso

router = APIRouter(prefix="/v1/personal", tags=["personal"])

# Slugs reservados: espelham as rotas top-level do portal + termos de sistema, para que
# um personal não escolha um slug que colidiria com uma rota real (coachpilot.com.br/<rota>).
SLUG_RESERVADOS = {
    "dashboard", "alunos", "aluno", "agenda", "plano", "planos", "perfil", "captacao",
    "cadastro", "loja", "divulgador", "token", "blog", "api", "v1", "admin", "ajuda",
    "notificacoes", "pacotes", "loja-vendas", "financeiro", "configuracoes", "settings",
    "login", "logout", "sobre", "app", "www", "suporte", "contato", "termos", "privacidade",
}
_SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$")


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
    notif_treino_concluido: Optional[bool] = None   # ausente no perfil = ligado


class AvatarUploadUrlBody(BaseModel):
    filename: str
    content_type: str


class SlugBody(BaseModel):
    slug: str


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


@router.post("/me/slug")
def set_slug(body: SlugBody, personal_id: str = Depends(get_current_personal_id)):
    """Define/atualiza o slug público do personal (coachpilot.com.br/@slug) para a página
    de captação. Slug é único globalmente (reserva SLUG#{slug} via put condicional)."""
    slug = body.slug.strip().lower()
    if not _SLUG_RE.match(slug):
        raise HTTPException(422, {
            "code": "SLUG_INVALIDO",
            "message": "Use 3 a 30 letras minúsculas, números ou hífen (sem começar/terminar com hífen).",
        })
    if slug in SLUG_RESERVADOS:
        raise HTTPException(409, {"code": "SLUG_RESERVADO", "message": "Este nome é reservado. Escolha outro."})

    perfil = repo.get_item(keys.pk_personal(personal_id), keys.SK_PROFILE) or {}
    old_slug = perfil.get("slug")
    if old_slug == slug:
        return {"slug": slug}

    if not repo.put_item_if_absent(keys.pk_slug(slug), "META", {"personal_id": personal_id}):
        dono = repo.get_item(keys.pk_slug(slug), "META")
        if not dono or dono.get("personal_id") != personal_id:
            raise HTTPException(409, {"code": "SLUG_TAKEN", "message": "Este nome já está em uso."})

    if old_slug and old_slug != slug:
        repo.delete_item(keys.pk_slug(old_slug), "META")
    repo.update_item(keys.pk_personal(personal_id), keys.SK_PROFILE,
                     {"slug": slug, "updated_at": now_iso()})
    return {"slug": slug}


@router.post("/me/avatar/upload-url")
def avatar_upload_url(body: AvatarUploadUrlBody, personal_id: str = Depends(get_current_personal_id)):
    result = media_service.gerar_presigned_upload_url_perfil(
        "personal", personal_id, body.filename, body.content_type
    )
    if not result:
        raise HTTPException(502, "Não foi possível gerar a URL de upload.")
    return result
