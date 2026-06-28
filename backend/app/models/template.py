from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import TipoExercicio
from app.models.exercicio import ExercicioSubstituto, SeriePrescrita


class ExercicioTemplate(BaseModel):
    nome: str
    grupo: Optional[str] = None
    ordem: int = 0
    dia_semana: Optional[int] = None
    tipo_exercicio: Optional[TipoExercicio] = TipoExercicio.FORCA
    rm_kg: Optional[float] = None
    unidade_carga: Optional[str] = None
    unidade_reps: Optional[str] = None
    series: Optional[int] = None
    reps_prescritas: Optional[str] = None
    carga_prescrita: Optional[str] = None
    series_prescritas: Optional[list[SeriePrescrita]] = None
    intervalo_s: Optional[int] = None
    video_url: Optional[str] = None
    observacoes: Optional[str] = None
    links_uteis: list[str] = []
    links_uteis_excluidos: list[str] = []
    substitutos: list[ExercicioSubstituto] = []
    substitutos_excluidos: list[str] = []


class TreinoTemplateCreate(BaseModel):
    nome: str
    foco: Optional[str] = None
    exercicios: list[ExercicioTemplate] = Field(default_factory=list)
    pacote_id: Optional[str] = None   # preenchido quando criado via importação de pacote
    ativo: bool = True                # False = oculto na montagem de treinos


class TreinoTemplateFromTreino(BaseModel):
    aluno_id: str
    treino_id: str
    nome: Optional[str] = None   # default: nome do treino de origem


class AplicarTemplateBody(BaseModel):
    aluno_ids: list[str]


class TreinoTemplate(TreinoTemplateCreate):
    template_id: str
    personal_id: str
    created_at: str
