"""Modelos para o sistema de pacotes de treino (.cpkg).

Um .cpkg é um arquivo JSON assinado com HMAC-SHA256 que carrega exercícios,
templates e rotinas prontos para importação. Dois tipos:
  - Licenciado: token de uso único por personal (campo `token` presente)
  - Livre: sem restrição de uso (campo `token` ausente), mas ainda assinado
"""
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import TipoExercicio
from app.models.exercicio import ExercicioSubstituto, SeriePrescrita


# ── Estrutura do arquivo .cpkg ────────────────────────────────────────────────

class PacoteInfo(BaseModel):
    id: str
    nome: str
    descricao: str = ""
    autor: str = ""
    versao: str = "1"


class ExercicioPacote(BaseModel):
    """Exercício dentro de um .cpkg — mapeado para ExLib no import."""
    ref: str                               # identificador interno do arquivo (ex: "ex_supino")
    nome: str
    grupo: Optional[str] = None
    video_url: Optional[str] = None
    descricao: Optional[str] = None
    recomendacoes: Optional[str] = None
    tipo_exercicio: TipoExercicio = TipoExercicio.FORCA
    substitutos: list[ExercicioSubstituto] = Field(default_factory=list)


class ExercicioPacoteTemplate(BaseModel):
    """Exercício dentro de um template no arquivo — usa ex_ref para resolução."""
    ex_ref: str
    ordem: int = 0
    series_prescritas: Optional[list[SeriePrescrita]] = None
    intervalo_s: Optional[int] = None
    observacoes: Optional[str] = None


class TemplatePacote(BaseModel):
    ref: str                               # ex: "tmpl_peito_a"
    nome: str
    foco: Optional[str] = None
    exercicios: list[ExercicioPacoteTemplate] = Field(default_factory=list)


class RotinaPacote(BaseModel):
    ref: str                               # ex: "rot_abc"
    nome: str
    descricao: Optional[str] = None
    treinos: list[str] = Field(default_factory=list)   # lista de tmpl refs em ordem


class PacoteRefFile(BaseModel):
    """Arquivo .cpkg LICENCIADO (Opção A): só referência, sem conteúdo.
    O conteúdo real mora no servidor em PACOTEDISTRIB#{pacote_id}. Nada copiável aqui."""
    fmt: str                               # discriminador — "cpkg-ref-1"
    pacote_id: str
    token: str


class PacoteFile(BaseModel):
    """Shape de um draft LIVRE (.json) — conteúdo legível, editável pela IA. Sem assinatura."""
    version: str = "1"
    token: Optional[str] = None            # ignorado no fluxo livre (drafts não carregam token)
    pacote: PacoteInfo
    exercicios: list[ExercicioPacote] = Field(default_factory=list)
    templates: list[TemplatePacote] = Field(default_factory=list)
    rotinas: list[RotinaPacote] = Field(default_factory=list)
    assinatura: Optional[str] = None       # legado — não mais exigido/verificado


# ── API request / response ───────────────────────────────────────────────────

class ImportarPacoteRequest(BaseModel):
    conteudo: str                          # conteúdo completo do .cpkg como string JSON


class ImportarPacoteResponse(BaseModel):
    pacote_id: str
    nome: str
    licenciado: bool
    exercicios_importados: int
    templates_importados: int
    rotinas_importadas: int


class PacoteInstalado(BaseModel):
    pacote_id: str
    nome: str
    descricao: str = ""
    autor: str = ""
    versao: str = ""
    licenciado: bool = False
    ativo: bool = True
    exlib_ids: list[str] = Field(default_factory=list)
    template_ids: list[str] = Field(default_factory=list)
    rotina_ids: list[str] = Field(default_factory=list)
    importado_em: str


class TogglePacoteBody(BaseModel):
    ativo: bool


class ToggleItemBody(BaseModel):
    ativo: bool


class GerarPacoteBody(BaseModel):
    nome: str
    descricao: str = ""
    autor: str = ""
    versao: str = "1.0"
    template_ids: list[str] = Field(default_factory=list)
    rotina_ids: list[str] = Field(default_factory=list)


class GerarPacoteLicenciadoBody(GerarPacoteBody):
    max_usos: int = 1
