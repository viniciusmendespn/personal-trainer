from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.enums import AlunoStatus


class AlunoCreate(BaseModel):
    nome: str
    telefone: str                              # E.164 sem '+' (ex.: 5531999998888)
    email: Optional[str] = None
    endereco: Optional[str] = None
    data_nascimento: Optional[str] = None      # ISO date (YYYY-MM-DD)
    objetivo: Optional[str] = None
    observacoes: Optional[str] = None
    custom: dict[str, Any] = Field(default_factory=dict)


class AlunoUpdate(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    data_nascimento: Optional[str] = None
    objetivo: Optional[str] = None
    observacoes: Optional[str] = None
    status: Optional[AlunoStatus] = None
    custom: Optional[dict[str, Any]] = None


class Aluno(AlunoCreate):
    aluno_id: str
    personal_id: str
    status: AlunoStatus = AlunoStatus.ATIVO
    created_at: str
    updated_at: str
