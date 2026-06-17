from typing import Any, Optional

from pydantic import BaseModel, Field


class SeriePrescrita(BaseModel):
    series: int
    reps: str
    carga: Optional[str] = None


class ExercicioCreate(BaseModel):
    nome: str                                  # ex.: "Supino reto"
    ordem: int = 0
    series: Optional[int] = None               # legado — leitura de itens antigos
    reps_prescritas: Optional[str] = None      # legado — leitura de itens antigos
    carga_prescrita: Optional[str] = None      # legado — leitura de itens antigos
    series_prescritas: Optional[list[SeriePrescrita]] = None  # prescrição estruturada
    intervalo_s: Optional[int] = None
    video_url: Optional[str] = None
    observacoes: Optional[str] = None
    custom: dict[str, Any] = Field(default_factory=dict)


class Exercicio(ExercicioCreate):
    exercicio_id: str
    treino_id: str
    aluno_id: str
