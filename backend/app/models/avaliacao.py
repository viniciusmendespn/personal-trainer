from typing import Any, Optional

from pydantic import BaseModel, Field


class AvaliacaoCreate(BaseModel):
    data: Optional[str] = None                 # ISO date; default = hoje
    peso: Optional[float] = None               # kg
    altura_cm: Optional[float] = None
    percentual_gordura: Optional[float] = None
    medidas: dict[str, Any] = Field(default_factory=dict)   # ex.: {"cintura": 80, "braco": 38}
    observacoes: Optional[str] = None


class Avaliacao(AvaliacaoCreate):
    avaliacao_id: str
    aluno_id: str
    created_at: str
