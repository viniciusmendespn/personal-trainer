"""Férias / ausências do aluno — períodos registrados com antecedência para o personal
se programar. Item permanente na partição AL#{aluno_id} (sem TTL)."""
from pydantic import BaseModel


class FeriasCreate(BaseModel):
    data_inicio: str                      # YYYY-MM-DD
    data_fim: str                         # YYYY-MM-DD (>= data_inicio)
    observacao: str | None = None


class FeriasUpdate(BaseModel):
    data_inicio: str | None = None
    data_fim: str | None = None
    observacao: str | None = None


class Ferias(FeriasCreate):
    ferias_id: str
    aluno_id: str
    personal_id: str
    criado_por: str = "PERSONAL"          # "PERSONAL" | "ALUNO"
    created_at: str
    ts: str                               # epoch_ms — compõe o SK (imutável)
