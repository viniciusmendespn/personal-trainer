from typing import Literal

from pydantic import BaseModel, Field


class PropostaPrograma(BaseModel):
    proposta_id: str
    aluno_id: str
    personal_id: str
    revisao: int = 1
    revisao_base: int
    programa: dict
    programa_base: dict
    resumo_da_mudanca: str
    diferencas: list[dict] = Field(default_factory=list)
    validacao: dict = Field(default_factory=dict)
    created_at: str
    updated_at: str
    expires_at: int
    estado: Literal["rascunho", "valida", "invalida", "desatualizada", "aplicando", "aplicada", "descartada", "expirada"]
    operation_id: str | None = None
