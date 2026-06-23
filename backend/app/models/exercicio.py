from typing import Any, Optional

from pydantic import BaseModel, Field


class SeriePrescrita(BaseModel):
    series: int
    reps: str
    carga: Optional[str] = None


class ExercicioSubstituto(BaseModel):
    """Opção de troca para um exercício — cópia (nome/vídeo/observação) feita no momento em
    que o personal escolhe, não referência viva. Pode ter vindo da biblioteca ou ser 100%
    customizada — uma vez salva, é só esse snapshot."""
    nome: str
    video_url: Optional[str] = None
    observacao: Optional[str] = None
    series_prescritas: Optional[list[SeriePrescrita]] = None


class ExercicioCreate(BaseModel):
    nome: str                                  # ex.: "Supino reto"
    grupo: Optional[str] = None                # ex.: "Peito", "Pernas" — herdado da biblioteca ou livre
    ordem: int = 0
    series: Optional[int] = None               # legado — leitura de itens antigos
    reps_prescritas: Optional[str] = None      # legado — leitura de itens antigos
    carga_prescrita: Optional[str] = None      # legado — leitura de itens antigos
    series_prescritas: Optional[list[SeriePrescrita]] = None  # prescrição estruturada
    intervalo_s: Optional[int] = None
    video_url: Optional[str] = None
    observacoes: Optional[str] = None
    links_uteis: list[str] = []                 # post_sks adicionados diretamente a este exercício
    links_uteis_excluidos: list[str] = []       # post_sks da biblioteca ocultados para este aluno
    substitutos: list[ExercicioSubstituto] = []        # substitutos adicionados diretamente neste treino
    substitutos_excluidos: list[str] = []              # nomes (lowercase) dos substitutos da biblioteca ocultados para este aluno
    custom: dict[str, Any] = Field(default_factory=dict)


class Exercicio(ExercicioCreate):
    exercicio_id: str
    treino_id: str
    aluno_id: str
