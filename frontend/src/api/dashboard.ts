import { api } from './client'

export interface SessaoDia {
  data: string
  total: number
}

export interface AtividadeAluno {
  aluno_id: string
  aluno_nome: string
  foto_url: string | null
  status: 'EM_ANDAMENTO' | 'FINALIZADA'
  treino_nome: string | null
  exercicio_atual: string | null
  ordem_atual: number | null
  total_ex: number | null
  atualizado_em: string
}

export interface DashboardData {
  alunos: number
  alunos_ativos: number
  notificacoes_nao_lidas: number
  sessoes_por_dia?: SessaoDia[]
  atividade_recente?: AtividadeAluno[]
}

export const dashboardApi = {
  get: () => api.get<DashboardData>('/v1/dashboard').then((r) => r.data),
}
