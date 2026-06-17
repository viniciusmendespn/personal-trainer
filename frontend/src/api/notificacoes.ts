import { api } from './client'

export interface Notificacao {
  ref: string
  notif_id: string
  tipo: string
  titulo: string
  mensagem: string
  aluno_id?: string
  lida: boolean
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
  payload?: { midia_id?: string; s3_key?: string; tipo?: string; [key: string]: unknown }
}

export interface NotificacaoPage {
  items: Notificacao[]
  next_cursor: string | null
}

export const notifApi = {
  list: (params: { cursor?: string; limit?: number } = {}) =>
    api.get<NotificacaoPage>('/v1/notificacoes', { params }).then((r) => r.data),
  get: (ref: string) => api.get<Notificacao>('/v1/notificacoes/item', { params: { ref } }).then((r) => r.data),
  remove: (ref: string) => api.delete('/v1/notificacoes/item', { params: { ref } }),
  unread: () => api.get<{ count: number }>('/v1/notificacoes/unread').then((r) => r.data),
  read: (ref: string) => api.post('/v1/notificacoes/read', { ref }),
  readAll: () => api.post('/v1/notificacoes/read-all'),
  listPendencias: () => api.get<Pendencia[]>('/v1/pendencias').then((r) => r.data),
  resolvePendencia: (ref: string) => api.post('/v1/pendencias/resolve', { ref }),
}
