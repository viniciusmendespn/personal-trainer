import { api } from './client'

export interface SessaoDia {
  data: string
  total: number
}

export interface DashboardData {
  alunos: number
  alunos_ativos: number
  notificacoes_nao_lidas: number
  sessoes_por_dia?: SessaoDia[]
}

export const dashboardApi = {
  get: () => api.get<DashboardData>('/v1/dashboard').then((r) => r.data),
}
