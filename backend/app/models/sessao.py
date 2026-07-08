from typing import Optional

from pydantic import BaseModel

from app.models.enums import SessaoStatus, TipoExercicio


class ExercicioAtual(BaseModel):
    """Snapshot denormalizado do exercício corrente, embutido na sessão ativa
    para o agente ler tudo em 1 GetItem (ESPEC §3)."""
    exercicio_id: str
    nome: str
    tipo_exercicio: Optional[TipoExercicio] = None
    series: Optional[int] = None
    reps_prescritas: Optional[str] = None
    carga_prescrita: Optional[str] = None
    series_prescritas: Optional[list] = None
    intervalo_s: Optional[int] = None
    unidade_reps: Optional[str] = None             # PERFORMANCE: unidade da métrica
    metrica_direcao: Optional[str] = "MAIOR"       # PERFORMANCE: direção do PR (MAIOR|MENOR)


class ScoreBloco(BaseModel):
    """Resultado de um bloco de WOD informado na finalização da sessão (spec CROSSFIT §3.2)."""
    bloco_id: str
    formato: str                               # FOR_TIME | AMRAP | EMOM (validado contra o bloco do treino)
    tempo_s: Optional[int] = None              # FOR_TIME: tempo total
    cap_estourado: bool = False                # FOR_TIME: não terminou dentro do time cap
    reps_restantes: Optional[int] = None       # FOR_TIME capado: reps que faltaram
    rounds: Optional[int] = None               # AMRAP: rounds completos
    reps_extras: Optional[int] = None          # AMRAP: reps do round incompleto
    minutos_completos: Optional[int] = None    # EMOM: minutos cumpridos
    rx: bool = True                            # False = adaptado/scaled


class FinishBody(BaseModel):
    """Payload opcional do finish — ausente = comportamento clássico (musculação)."""
    scores_blocos: list[ScoreBloco] = []


class SessaoTreino(BaseModel):
    sessao_id: str
    aluno_id: str
    personal_id: str
    treino_id: str
    treino_nome: str
    status: SessaoStatus = SessaoStatus.EM_ANDAMENTO
    ex_atual: Optional[ExercicioAtual] = None
    ordem_atual: int = 0
    total_ex: int = 0
    data_hora_inicio: str
    data_hora_fim: Optional[str] = None
    duracao_segundos: Optional[int] = None
    exercicios_exec: Optional[list] = None
