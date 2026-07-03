"""Endpoints PÚBLICOS da loja (catálogo) — sem autenticação (PublicProxy /v1/public/*).
Em produção o CloudFront da loja cacheia essas respostas (TTL curto)."""
from fastapi import APIRouter, Query

from app.services import loja_service

router = APIRouter(prefix="/v1/public/loja", tags=["loja-public"])


@router.get("/anuncios")
def listar_catalogo(
    limit: int = Query(default=24, ge=1, le=60),
    cursor: str | None = None,
):
    return loja_service.listar_catalogo(limit, cursor)


@router.get("/anuncios/{anuncio_id}")
def detalhe_anuncio(anuncio_id: str):
    return loja_service.detalhe_publico(anuncio_id)


@router.get("/anuncios/{anuncio_id}/avaliacoes")
def listar_avaliacoes(
    anuncio_id: str,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = None,
):
    return loja_service.listar_avaliacoes(anuncio_id, limit, cursor)
