"""Endpoints autenticados da loja — vendedor (anúncios/vendas) e comprador (pedidos)."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_personal_id
from app.models.loja import (
    AvaliarBody,
    CapaUploadUrlBody,
    CriarAnuncioBody,
    CriarPedidoBody,
    EditarAnuncioBody,
)
from app.services import loja_service, media_service

router = APIRouter(prefix="/v1/loja", tags=["loja"])


# ── Vendedor: anúncios ────────────────────────────────────────────────────────

@router.post("/anuncios", status_code=201)
def criar_anuncio(body: CriarAnuncioBody, personal_id: str = Depends(get_current_personal_id)):
    return loja_service.criar_anuncio(personal_id, body)


@router.patch("/anuncios/{anuncio_id}")
def editar_anuncio(anuncio_id: str, body: EditarAnuncioBody,
                   personal_id: str = Depends(get_current_personal_id)):
    return loja_service.editar_anuncio(personal_id, anuncio_id, body)


@router.get("/meus-anuncios")
def meus_anuncios(personal_id: str = Depends(get_current_personal_id)):
    return {"anuncios": loja_service.meus_anuncios(personal_id)}


@router.post("/anuncios/capa-upload-url")
def capa_upload_url(body: CapaUploadUrlBody,
                    personal_id: str = Depends(get_current_personal_id)):
    result = media_service.gerar_presigned_upload_url_loja(
        personal_id, body.filename, body.content_type
    )
    if not result:
        raise HTTPException(502, "Não foi possível gerar a URL de upload.")
    return result


# ── Comprador: pedidos ────────────────────────────────────────────────────────

@router.post("/pedidos", status_code=201)
def criar_pedido(body: CriarPedidoBody, personal_id: str = Depends(get_current_personal_id)):
    return loja_service.criar_pedido(personal_id, body.anuncio_id)


@router.get("/pedidos/{pedido_id}")
def get_pedido(pedido_id: str, personal_id: str = Depends(get_current_personal_id)):
    return loja_service.get_pedido(personal_id, pedido_id)


@router.post("/pedidos/{pedido_id}/instalar")
def instalar_pedido(pedido_id: str, personal_id: str = Depends(get_current_personal_id)):
    return loja_service.instalar(personal_id, pedido_id)


@router.get("/pedidos/{pedido_id}/download")
def download_pedido(pedido_id: str, personal_id: str = Depends(get_current_personal_id)):
    return loja_service.download(personal_id, pedido_id)


@router.post("/pedidos/{pedido_id}/cancelar")
def cancelar_pedido(pedido_id: str, personal_id: str = Depends(get_current_personal_id)):
    return loja_service.cancelar_pedido(personal_id, pedido_id)


@router.get("/minhas-compras")
def minhas_compras(personal_id: str = Depends(get_current_personal_id),
                   limit: int = Query(default=50, ge=1, le=100),
                   cursor: str | None = None):
    return loja_service.minhas_compras(personal_id, limit, cursor)


# ── Vendedor: vendas ─────────────────────────────────────────────────────────

@router.get("/minhas-vendas")
def minhas_vendas(personal_id: str = Depends(get_current_personal_id),
                  limit: int = Query(default=50, ge=1, le=100),
                  cursor: str | None = None):
    return loja_service.minhas_vendas(personal_id, limit, cursor)


@router.post("/vendas/{pedido_id}/confirmar")
def confirmar_venda(pedido_id: str, personal_id: str = Depends(get_current_personal_id)):
    return loja_service.confirmar_venda(personal_id, pedido_id)


@router.post("/vendas/{pedido_id}/cancelar")
def cancelar_venda(pedido_id: str, personal_id: str = Depends(get_current_personal_id)):
    return loja_service.cancelar_pedido(personal_id, pedido_id)


# ── Comprador: avaliações ────────────────────────────────────────────────────

@router.post("/anuncios/{anuncio_id}/avaliacoes")
def avaliar(anuncio_id: str, body: AvaliarBody,
            personal_id: str = Depends(get_current_personal_id)):
    return loja_service.avaliar(personal_id, anuncio_id, body)
