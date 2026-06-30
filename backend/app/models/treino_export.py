"""Formato de export/import do PROGRAMA de treino de um aluno (todos os treinos +
exercícios num só arquivo, editável por IA). Diferente do pacote (.cpkg, que alimenta a
biblioteca de templates/rotinas): aqui o JSON vai direto para os treinos atribuídos a um
aluno (partição AL#{aluno_id}), com semântica de SUBSTITUIÇÃO TOTAL no import.

Arquivo enxuto: sem campos internos (treino_id, aluno_id, links_uteis, custom,
canonical_exercicio_id, rm_kg, origem_licenciada). `ordem` é implícita pela posição no array.
`ref` (t_a, t_b, …) existe só para legibilidade — não é persistido."""
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import TipoExercicio
from app.models.exercicio import ExercicioSubstituto, SeriePrescrita


class ExercicioTreinoFile(BaseModel):
    nome: str
    grupo: Optional[str] = None
    tipo_exercicio: TipoExercicio = TipoExercicio.FORCA
    series_prescritas: Optional[list[SeriePrescrita]] = None
    intervalo_s: Optional[int] = None
    video_url: Optional[str] = None
    observacoes: Optional[str] = None
    unidade_carga: Optional[str] = None
    unidade_reps: Optional[str] = None
    metrica_direcao: Optional[str] = "MAIOR"   # PERFORMANCE: "MAIOR"|"MENOR"
    substitutos: list[ExercicioSubstituto] = Field(default_factory=list)


class TreinoFileItem(BaseModel):
    ref: Optional[str] = None              # só legibilidade (t_a, t_b…) — não persistido
    nome: str
    foco: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: bool = True
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    exercicios: list[ExercicioTreinoFile] = Field(default_factory=list)


class ProgramaTreinoFile(BaseModel):
    version: str = "1"
    treinos: list[TreinoFileItem] = Field(default_factory=list)


class ImportarProgramaResponse(BaseModel):
    treinos_importados: int
    exercicios_importados: int
