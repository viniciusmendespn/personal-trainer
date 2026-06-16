from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.enums import Ator, CanalOrigem, Classificacao


class SerieExec(BaseModel):
    """Uma série executada. Acumuladas numa lista do mesmo Registro (ESPEC §3)."""
    carga: Optional[str] = None
    reps: Optional[int] = None
    rpe: Optional[float] = None                # percepção de esforço (0-10)


class Registro(BaseModel):
    sessao_id: str
    exercicio_id: str
    exercicio_nome: str                        # denorm p/ histórico/agente sem 2º get
    aluno_id: str
    series_exec: list[SerieExec] = Field(default_factory=list)
    rm: Optional[str] = None                   # repetição máxima, se informado
    data_hora: str
    # Rastreabilidade (RN010 / ESPEC §4)
    canal_origem: CanalOrigem
    classificacao: Classificacao = Classificacao.AUTO
    ator: Ator = Ator.ALUNO
    custom: dict[str, Any] = Field(default_factory=dict)
