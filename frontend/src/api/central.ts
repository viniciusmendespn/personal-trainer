import { api } from './client'
import type { Notificacao, Pendencia } from './notificacoes'

export type CentralItem = ({ kind: 'NOTIF' } & Notificacao) | ({ kind: 'PENDENCIA' } & Pendencia)

export interface CentralResponse {
  items: CentralItem[]
  total: number
}

export const centralApi = {
  get: () => api.get<CentralResponse>('/v1/central').then((r) => r.data),
  vincularMidia: (body: { ref: string; aluno_id: string; midia_id: string; exercicio_id: string; exercicio_nome?: string }) =>
    api.post('/v1/pendencias/vincular-exercicio', body),
}
