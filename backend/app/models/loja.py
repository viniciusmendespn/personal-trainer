"""Modelos do marketplace de pacotes (loja.coachpilot.com.br)."""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

# Estados do pedido (state machine — transições sempre condicionais no Dynamo)
PEDIDO_AGUARDANDO_PAGAMENTO = "AGUARDANDO_PAGAMENTO"   # modo MP, PIX pendente
PEDIDO_AGUARDANDO_VENDEDOR = "AGUARDANDO_VENDEDOR"     # modo MANUAL, pagamento por fora
PEDIDO_ENTREGUE = "ENTREGUE"
PEDIDO_EXPIRADO = "EXPIRADO"                            # só MP (PIX venceu)
PEDIDO_CANCELADO = "CANCELADO"

ANUNCIO_PUBLICADO = "PUBLICADO"
ANUNCIO_PAUSADO = "PAUSADO"
ANUNCIO_REMOVIDO_ADMIN = "REMOVIDO_ADMIN"


def _validar_preco(v: Optional[int]) -> Optional[int]:
    """0 = pacote gratuito (resgate sem pagamento); pago é R$ 1,00 a R$ 5.000,00."""
    if v is not None and v != 0 and v < 100:
        raise ValueError("Preço deve ser 0 (gratuito) ou a partir de R$ 1,00.")
    return v


class CriarAnuncioBody(BaseModel):
    pacote_id: str
    titulo: str = Field(min_length=3, max_length=120)
    descricao: str = Field(min_length=10, max_length=8000)
    preco_centavos: int = Field(ge=0, le=500000)   # 0 (grátis) ou R$ 1,00 a R$ 5.000,00
    capa_s3_key: Optional[str] = None

    _preco = field_validator("preco_centavos")(_validar_preco)


class EditarAnuncioBody(BaseModel):
    titulo: Optional[str] = Field(default=None, min_length=3, max_length=120)
    descricao: Optional[str] = Field(default=None, min_length=10, max_length=8000)
    preco_centavos: Optional[int] = Field(default=None, ge=0, le=500000)
    capa_s3_key: Optional[str] = None
    pacote_id: Optional[str] = None   # vendedor re-gerou o pacote (nova versão)
    status: Optional[Literal["PUBLICADO", "PAUSADO"]] = None

    _preco = field_validator("preco_centavos")(_validar_preco)


class CapaUploadUrlBody(BaseModel):
    filename: str
    content_type: str


class CriarPedidoBody(BaseModel):
    anuncio_id: str


class AvaliarBody(BaseModel):
    nota: int = Field(ge=1, le=5)
    comentario: str = Field(default="", max_length=1000)
