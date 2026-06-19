from typing import Any, Optional

from pydantic import BaseModel, Field


class MetricaCustomizada(BaseModel):
    nome: str
    unidade: str = Field(max_length=10)  # texto livre (kg, cm, %, bpm...) — curto p/ caber no gráfico
    valor: float


class AvaliacaoCreate(BaseModel):
    data: Optional[str] = None                 # ISO date; default = hoje
    peso: Optional[float] = None               # kg
    altura_cm: Optional[float] = None
    percentual_gordura: Optional[float] = None
    medidas: dict[str, Any] = Field(default_factory=dict)   # ex.: {"cintura": 80, "braco": 38}
    metricas: list[MetricaCustomizada] = Field(default_factory=list)  # métricas customizadas (nome+unidade+valor)
    observacoes: Optional[str] = None
    fotos_s3_keys: list[str] = Field(default_factory=list)  # fotos p/ comparação na timeline
    bio_scan_s3_key: Optional[str] = None                   # anexo do resultado da bioimpedância


class Avaliacao(AvaliacaoCreate):
    avaliacao_id: str
    aluno_id: str
    created_at: str


class AvaliacaoUpdate(BaseModel):
    data: Optional[str] = None
    peso: Optional[float] = None
    altura_cm: Optional[float] = None
    percentual_gordura: Optional[float] = None
    medidas: Optional[dict[str, Any]] = None
    metricas: Optional[list[MetricaCustomizada]] = None
    observacoes: Optional[str] = None
    fotos_s3_keys: Optional[list[str]] = None
    bio_scan_s3_key: Optional[str] = None
