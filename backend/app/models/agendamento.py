from typing import Optional

from pydantic import BaseModel

from app.models.enums import AgendamentoStatus


class AgendamentoCreate(BaseModel):
    aluno_id: str
    data_hora_inicio: str   # ISO8601, sortável
    duracao_min: int = 60
    observacao: Optional[str] = None


class AgendamentoUpdate(BaseModel):
    data_hora_inicio: Optional[str] = None
    duracao_min: Optional[int] = None
    observacao: Optional[str] = None


class Agendamento(AgendamentoCreate):
    agendamento_id: str
    personal_id: str
    status: AgendamentoStatus
    created_at: str
