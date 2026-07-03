"""Modelos do marketplace de pacotes (loja.coachpilot.com.br)."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

# Estados do pedido (state machine — transições sempre condicionais no Dynamo)
PEDIDO_AGUARDANDO_PAGAMENTO = "AGUARDANDO_PAGAMENTO"   # modo MP, PIX pendente
PEDIDO_AGUARDANDO_VENDEDOR = "AGUARDANDO_VENDEDOR"     # modo MANUAL, pagamento por fora
PEDIDO_ENTREGUE = "ENTREGUE"
PEDIDO_EXPIRADO = "EXPIRADO"                            # só MP (PIX venceu)
PEDIDO_CANCELADO = "CANCELADO"

ANUNCIO_PUBLICADO = "PUBLICADO"
ANUNCIO_PAUSADO = "PAUSADO"
ANUNCIO_REMOVIDO_ADMIN = "REMOVIDO_ADMIN"


class CriarAnuncioBody(BaseModel):
    pacote_id: str
    titulo: str = Field(min_length=3, max_length=120)
    descricao: str = Field(min_length=10, max_length=8000)
    preco_centavos: int = Field(ge=100, le=500000)   # R$ 1,00 a R$ 5.000,00
    capa_s3_key: Optional[str] = None


class EditarAnuncioBody(BaseModel):
    titulo: Optional[str] = Field(default=None, min_length=3, max_length=120)
    descricao: Optional[str] = Field(default=None, min_length=10, max_length=8000)
    preco_centavos: Optional[int] = Field(default=None, ge=100, le=500000)
    capa_s3_key: Optional[str] = None
    pacote_id: Optional[str] = None   # vendedor re-gerou o pacote (nova versão)
    status: Optional[Literal["PUBLICADO", "PAUSADO"]] = None


class CapaUploadUrlBody(BaseModel):
    filename: str
    content_type: str


class CriarPedidoBody(BaseModel):
    anuncio_id: str


class AvaliarBody(BaseModel):
    nota: int = Field(ge=1, le=5)
    comentario: str = Field(default="", max_length=1000)
