import { api } from './client'

export interface SessaoDia {
  data: string
  total: number
}

export interface AtividadeAluno {
  aluno_id: string
  aluno_nome: string
  foto_url: string | null
  status: 'EM_ANDAMENTO' | 'FINALIZADA' | 'ABANDONADA'
  treino_nome: string | null
  exercicio_atual: string | null
  ordem_atual: number | null
  total_ex: number | null
  atualizado_em: string
}

export interface ProximoEvento {
  agendamento_id: string
  aluno_id: string
  data_hora_inicio: string
  duracao_min: number
  status: string
  observacao?: string
}

export interface DashboardData {
  alunos: number
  alunos_ativos: number
  notificacoes_nao_lidas: number
  sessoes_por_dia?: SessaoDia[]
  atividade_recente?: AtividadeAluno[]
  aderencia_7d?: { alunos_unicos: number; alunos_unicos_prev: number }
  alunos_app?: number
  dist_objetivos?: Record<string, number>
  proximos_eventos?: ProximoEvento[]
}

export const dashboardApi = {
  get: () => api.get<DashboardData>('/v1/dashboard').then((r) => r.data),
}
