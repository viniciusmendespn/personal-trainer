from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.enums import AlunoStatus
from app.utils import tz_valido


def _validar_tz(v: Optional[str]) -> Optional[str]:
    """Recusa offset ('-3') e nome inexistente. Só nome IANA — docs/TIMEZONE.md §5."""
    if v is not None and v != "" and not tz_valido(v):
        raise ValueError("Fuso horário inválido — use um nome IANA (ex.: America/Sao_Paulo)")
    return v or None


class AlunoCreate(BaseModel):
    nome: str
    telefone: str                              # E.164 sem '+' (ex.: 5531999998888)
    email: Optional[str] = None
    endereco: Optional[str] = None
    data_nascimento: Optional[str] = None      # ISO date (YYYY-MM-DD)
    objetivos: list[str] = Field(default_factory=list)
    observacoes: Optional[str] = None
    descricao: Optional[str] = None            # tagline curta exibida no perfil
    timezone: Optional[str] = None             # IANA; None = herda o do personal
    custom: dict[str, Any] = Field(default_factory=dict)

    _tz = field_validator("timezone")(_validar_tz)


class AlunoUpdate(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    data_nascimento: Optional[str] = None
    objetivos: Optional[list[str]] = None
    observacoes: Optional[str] = None
    descricao: Optional[str] = None
    status: Optional[AlunoStatus] = None
    foto_s3_key: Optional[str] = None          # chave S3 da foto de perfil
    timezone: Optional[str] = None             # IANA; None = herda o do personal
    custom: Optional[dict[str, Any]] = None

    _tz = field_validator("timezone")(_validar_tz)


class Aluno(AlunoCreate):
    aluno_id: str
    personal_id: str
    status: AlunoStatus = AlunoStatus.ATIVO
    foto_s3_key: Optional[str] = None
    foto_url: Optional[str] = None             # presigned GET, gerado na resposta
    agente_habilitado: bool = False
    acesso_token: Optional[str] = None
    session_revoked_before: Optional[int] = None  # Unix timestamp da última revogação
    created_at: str
    updated_at: str


class ImportarAlunosBody(BaseModel):
    alunos: list[AlunoCreate]


class ImportarResult(BaseModel):
    importados: int
    pulados: int
    erros: list[str]
