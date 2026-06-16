from typing import Any, Optional

from pydantic import BaseModel, Field


class TreinoCreate(BaseModel):
    nome: str                                  # ex.: "Treino A — Inferiores"
    ordem: int = 0
    foco: Optional[str] = None                 # ex.: "Inferiores", "Peito/Tríceps"
    observacoes: Optional[str] = None
    ativo: bool = True
    dias_semana: list[int] = Field(default_factory=list)   # 0=seg .. 6=dom (agenda)
    custom: dict[str, Any] = Field(default_factory=dict)


class Treino(TreinoCreate):
    treino_id: str
    aluno_id: str
    created_at: str
    updated_at: str
