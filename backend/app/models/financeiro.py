"""Modelos Pydantic do módulo financeiro. Espelhar enums em frontend/src/types/index.ts."""
from typing import Optional
from pydantic import BaseModel, Field


class CobrancaConfigIn(BaseModel):
    valor: float = Field(gt=0)
    recorrencia: str = Field(pattern="^(MENSAL|ANUAL)$")
    dia_vencimento: int = Field(ge=1, le=28)
    ativo: bool = True
    dias_antecedencia: int = Field(default=15, ge=1, le=60)


class CobrancaConfigOut(BaseModel):
    aluno_id: str
    personal_id: str
    valor: float
    recorrencia: str
    dia_vencimento: int
    ativo: bool
    dias_antecedencia: int
    criado_em: str
    atualizado_em: str


class NovaCobrancaIn(BaseModel):
    valor: float = Field(gt=0)
    vencimento: str  # YYYY-MM-DD
    recorrencia: str = Field(default="MENSAL", pattern="^(MENSAL|ANUAL)$")
    notas: Optional[str] = None


class RegistrarPagamentoIn(BaseModel):
    data_pagamento: str  # YYYY-MM-DD
    notas: Optional[str] = None
    forma_pagamento: str = Field(default="MANUAL", pattern="^(MANUAL|PIX_MP)$")


class MercadoPagoConfigIn(BaseModel):
    access_token: str = Field(min_length=10)
