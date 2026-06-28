"""Rotina = um split de treino completo (ABC, ABCDE…) com vários treinos. Pertence ao
personal (partição PT#), igual a Template. Snapshot embutido: a rotina guarda uma cópia
dos treinos+exercícios no momento em que é salva, então editar/excluir um template depois
não quebra a rotina (mesma estratégia dos Templates atuais)."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.models.template import ExercicioTemplate


class TreinoRotina(BaseModel):
    """Um dia do split (ex.: "Treino A — Peito/Tríceps"), com seus exercícios (snapshot)."""
    nome: str
    foco: Optional[str] = None
    ordem: int = 0
    exercicios: list[ExercicioTemplate] = Field(default_factory=list)


class RotinaCreate(BaseModel):
    nome: str                              # ex.: "Rotina ABC — Hipertrofia"
    descricao: Optional[str] = None
    treinos: list[TreinoRotina] = Field(default_factory=list)
    pacote_id: Optional[str] = None   # preenchido quando criado via importação de pacote
    ativo: bool = True                # False = oculto na montagem de treinos
    origem_licenciada: bool = False   # proveniência: veio (direta ou indiretamente) de pacote licenciado — bloqueia export
    template_ids: list[str] = Field(default_factory=list)  # templates de origem (from-templates)


class Rotina(RotinaCreate):
    rotina_id: str
    personal_id: str
    created_at: str


class RotinaFromAluno(BaseModel):
    aluno_id: str
    nome: Optional[str] = None             # default: "Rotina de {nome do aluno}"
    salvar_templates: bool = True          # também salvar cada treino como Template


class RotinaFromTemplates(BaseModel):
    nome: str
    descricao: Optional[str] = None
    template_ids: list[str] = Field(default_factory=list)


class AplicarRotinaBody(BaseModel):
    aluno_ids: list[str] = Field(default_factory=list)
    modo: Literal["adicionar", "substituir"] = "adicionar"   # UI pergunta na hora
