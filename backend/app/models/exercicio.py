from typing import Any, Optional

from pydantic import BaseModel, Field


class ExercicioCreate(BaseModel):
    nome: str                                  # ex.: "Supino reto"
    ordem: int = 0
    dia_semana: Optional[int] = None           # 0=seg..6=dom; None = todo dia (split intra-treino)
    series: Optional[int] = None               # ex.: 4
    reps_prescritas: Optional[str] = None      # str p/ faixas: "10" ou "8-12"
    carga_prescrita: Optional[str] = None      # str p/ flexibilidade: "30", "BW", "elástico"
    intervalo_s: Optional[int] = None
    video_url: Optional[str] = None
    observacoes: Optional[str] = None
    custom: dict[str, Any] = Field(default_factory=dict)


class Exercicio(ExercicioCreate):
    exercicio_id: str
    treino_id: str
    aluno_id: str
