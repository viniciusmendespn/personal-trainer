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
