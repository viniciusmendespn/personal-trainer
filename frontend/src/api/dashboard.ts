import { api } from './client'

export interface DashboardData {
  alunos: number
  alunos_ativos: number
  notificacoes_nao_lidas: number
  pendencias: number
}

export const dashboardApi = {
  get: () => api.get<DashboardData>('/v1/dashboard').then((r) => r.data),
}
