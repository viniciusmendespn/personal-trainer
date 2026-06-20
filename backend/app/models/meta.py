"""Metas / objetivos do aluno."""
from typing import Any
from pydantic import BaseModel

from app.models.enums import Ator


class MetaTipo(str):
    CARGA   = "CARGA"    # PR em um exercício
    PESO    = "PESO"     # peso corporal de avaliação
    MEDIDA  = "MEDIDA"   # medida corporal (cintura, braço, etc.)
    LIVRE   = "LIVRE"    # meta livre, verificada manualmente


class MetaStatus(str):
    PENDENTE  = "PENDENTE"
    APROVADA  = "APROVADA"
    CONCLUIDA = "CONCLUIDA"
    CANCELADA = "CANCELADA"


class MetaCreate(BaseModel):
    tipo: str                              # MetaTipo
    titulo: str
    descricao: str | None = None
    valor_alvo: float
    unidade: str                           # "kg", "cm", "%", etc.
    exercicio_id: str | None = None        # obrigatório se tipo=CARGA
    exercicio_nome: str | None = None
    campo_medida: str | None = None        # obrigatório se tipo=MEDIDA
    data_limite: str | None = None         # YYYY-MM-DD


class MetaUpdate(BaseModel):
    titulo: str | None = None
    descricao: str | None = None
    valor_alvo: float | None = None
    unidade: str | None = None
    exercicio_id: str | None = None
    exercicio_nome: str | None = None
    campo_medida: str | None = None
    data_limite: str | None = None


class Meta(MetaCreate):
    meta_id: str
    aluno_id: str
    personal_id: str
    status: str = MetaStatus.APROVADA
    criado_por: str = "PERSONAL"           # "PERSONAL" | "ALUNO"
    created_at: str
    ts: str                                # epoch_ms para compor o SK
    data_conclusao: str | None = None
    valor_atingido: float | None = None
