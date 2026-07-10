from typing import Any, Optional

from pydantic import BaseModel, Field


class BlocoParams(BaseModel):
    """Parâmetros do formato do bloco — só os que fazem sentido para o formato são usados."""
    rounds: Optional[int] = None               # quantas vezes repetir o bloco (todos os formatos)
    time_cap_s: Optional[int] = None           # FOR_TIME: tempo limite
    duracao_s: Optional[int] = None            # AMRAP/EMOM: duração total | DESCANSO: duração do descanso
    intervalo_s: Optional[int] = None          # EMOM: 60/90/120s ("Every 90s")
    descanso_rounds_s: Optional[int] = None    # descanso entre rounds do bloco


class BlocoTreino(BaseModel):
    """Bloco de um treino (ex.: "A) Força", "C) Metcon"). Exercícios apontam para o bloco
    via `bloco_id`; exercícios sem bloco continuam na lista plana clássica."""
    id: str
    nome: str
    ordem: int = 0
    formato: str = "LIVRE"                     # FormatoBloco: LIVRE|FOR_TIME|AMRAP|EMOM
    params: BlocoParams = Field(default_factory=BlocoParams)
    aquecimento: bool = False                  # bloco de warmup: sem formato/score, fora de PR/volume/pontos
    descanso: bool = False                     # bloco de descanso entre blocos (sem exercícios; duração em params.duracao_s)


class TreinoCreate(BaseModel):
    nome: str                                  # ex.: "Treino A — Inferiores"
    ordem: int = 0
    foco: Optional[str] = None                 # ex.: "Inferiores", "Peito/Tríceps"
    observacoes: Optional[str] = None
    ativo: bool = True
    data_inicio: Optional[str] = None          # período do programa (YYYY-MM-DD)
    data_fim: Optional[str] = None             # ao vencer, notifica o personal (scheduler)
    blocos: list[BlocoTreino] = []             # opcional (CrossFit/HIIT); vazio = treino clássico
    custom: dict[str, Any] = Field(default_factory=dict)
    origem_licenciada: bool = False            # proveniência: treino aplicado a partir de conteúdo licenciado


class Treino(TreinoCreate):
    treino_id: str
    aluno_id: str
    created_at: str
    updated_at: str
