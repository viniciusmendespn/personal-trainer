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
  midia_id?: string
  s3_key?: string
  relato_sk?: string
  relato_tipo?: 'dor' | 'duvida'
  exercicio_id?: string
  exercicio_nome?: string
}

export interface Comentario {
  com_id: string
  ator: 'ALUNO' | 'PERSONAL'
  texto: string
  data_hora: string
}

export interface RelatoThread {
  tipo: string
  descricao: string
  data_hora: string
  exercicio_id?: string
  exercicio_nome?: string
  respondido: boolean
  resposta_texto?: string
  relato_sk: string
  comentarios?: Comentario[]
}

export interface NotificacaoPage {
  items: Notificacao[]
  next_cursor: string | null
}

export const notifApi = {
  list: (params: { cursor?: string; limit?: number; tipo?: string } = {}) =>
    api.get<NotificacaoPage>('/v1/notificacoes', { params }).then((r) => r.data),
  get: (ref: string) => api.get<Notificacao>('/v1/notificacoes/item', { params: { ref } }).then((r) => r.data),
  remove: (ref: string) => api.delete('/v1/notificacoes/item', { params: { ref } }),
  unread: () => api.get<{ count: number }>('/v1/notificacoes/unread').then((r) => r.data),
  read: (ref: string) => api.post('/v1/notificacoes/read', { ref }),
  readAll: () => api.post('/v1/notificacoes/read-all'),
  vincularMidia: (body: { ref: string; aluno_id: string; midia_id: string; exercicio_id: string; exercicio_nome?: string }) =>
    api.post('/v1/notificacoes/vincular-midia', body),
  getRelato: (ref: string, aluno_id: string) =>
    api.get<RelatoThread>('/v1/notificacoes/relato', { params: { ref, aluno_id } }).then((r) => r.data),
  comentarRelato: (body: { ref: string; aluno_id: string; texto: string }) =>
    api.post('/v1/notificacoes/comentar', body).then((r) => r.data),
}
