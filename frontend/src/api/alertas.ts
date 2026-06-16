import { api } from './client'

export interface Alerta {
  ref: string
  alerta_id: string
  aluno_id: string
  exercicio_nome?: string
  descricao: string
  origem: string
  status: 'ABERTO' | 'VISTO' | 'RESOLVIDO'
  data_hora: string
}

export interface Pendencia {
  ref: string
  pendencia_id: string
  aluno_id: string
  tipo: string
  motivo: string
  status: string
  data_hora: string
}

export const alertasApi = {
  list: () => api.get<Alerta[]>('/v1/alertas').then((r) => r.data),
  resolve: (ref: string) => api.post('/v1/alertas/resolve', { ref }),
  listPendencias: () => api.get<Pendencia[]>('/v1/pendencias').then((r) => r.data),
  resolvePendencia: (ref: string) => api.post('/v1/pendencias/resolve', { ref }),
}
