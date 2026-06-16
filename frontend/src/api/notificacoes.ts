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
}

export const notifApi = {
  list: () => api.get<Notificacao[]>('/v1/notificacoes').then((r) => r.data),
  unread: () => api.get<{ count: number }>('/v1/notificacoes/unread').then((r) => r.data),
  read: (ref: string) => api.post('/v1/notificacoes/read', { ref }),
  readAll: () => api.post('/v1/notificacoes/read-all'),
  listPendencias: () => api.get<Pendencia[]>('/v1/pendencias').then((r) => r.data),
  resolvePendencia: (ref: string) => api.post('/v1/pendencias/resolve', { ref }),
}
