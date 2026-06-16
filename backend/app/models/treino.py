from typing import Any, Optional

from pydantic import BaseModel, Field


class TreinoCreate(BaseModel):
    nome: str                                  # ex.: "Treino A — Inferiores"
    ordem: int = 0
    foco: Optional[str] = None                 # ex.: "Inferiores", "Peito/Tríceps"
    observacoes: Optional[str] = None
    ativo: bool = True
    custom: dict[str, Any] = Field(default_factory=dict)


class Treino(TreinoCreate):
    treino_id: str
    aluno_id: str
    created_at: str
    updated_at: str
