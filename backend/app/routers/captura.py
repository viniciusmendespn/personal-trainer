"""Captação de leads — página pública do personal (coachpilot.com.br/@slug).

Endpoints SEM auth, resolvidos pelo slug na URL (mesmo padrão público do anamnese.py).
GET devolve o perfil do personal para renderizar a mini-landing; POST cria o lead e
dispara a notificação. O prospect NÃO ganha acesso ao app aqui — o personal fecha o
plano antes (diferente do auto-cadastro em /cadastro, que já cria aluno ATIVO)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import lead_service, media_service

router = APIRouter(tags=["captura"])

# Campos de rede social expostos na página pública (espelham PersonalProfileUpdate).
_SOCIAL_FIELDS = (
    "instagram_url", "tiktok_url", "youtube_url",
    "linkedin_url", "facebook_url", "x_url", "site_url",
)


class LeadBody(BaseModel):
    nome: str
    telefone: str
    objetivos: list[str] = []
    mensagem: str | None = None
    fonte: str | None = None


def _resolver_personal(slug: str) -> str:
    item = repo.get_item(keys.pk_slug(slug.strip().lower()), "META")
    if not item:
        raise HTTPException(404, "Página não encontrada")
    return item["personal_id"]


@router.get("/v1/public/captura")
def get_perfil_publico(slug: str):
    """Perfil do personal para a página de captação (nome, foto, bio, redes sociais)."""
    personal_id = _resolver_personal(slug)
    perfil = repo.get_item(keys.pk_personal(personal_id), keys.SK_PROFILE) or {}
    foto_key = perfil.get("foto_s3_key")
    return {
        "personal_nome": perfil.get("nome", "Personal"),
        "personal_foto_url": media_service.gerar_presigned_view_url(foto_key) if foto_key else None,
        "descricao": perfil.get("descricao"),
        "biografia": perfil.get("biografia"),
        **{campo: perfil.get(campo) for campo in _SOCIAL_FIELDS},
    }


@router.post("/v1/public/captura", status_code=201)
def enviar_lead(body: LeadBody, slug: str):
    """Cria o lead (status NOVO) e notifica o personal. Sem magic link."""
    personal_id = _resolver_personal(slug)
    telefone = "".join(c for c in body.telefone if c.isdigit())
    if not body.nome.strip() or not telefone:
        raise HTTPException(422, "Nome e telefone são obrigatórios.")
    lead_service.criar_lead(
        personal_id,
        nome=body.nome.strip(),
        telefone=telefone,
        objetivos=[o for o in body.objetivos if o and o.strip()],
        mensagem=body.mensagem,
        fonte=(body.fonte or "").strip() or None,
    )
    return {"ok": True}
