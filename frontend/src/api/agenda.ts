import { api } from './client'
import type { Agendamento, AgendamentoCreate, AgendamentoStatus } from '../types'

function tsId(a: Pick<Agendamento, 'data_hora_inicio' | 'agendamento_id'>) {
  return `${a.data_hora_inicio}#${a.agendamento_id}`
}

export const agendaApi = {
  list: (de: string, ate: string) =>
    api.get<Agendamento[]>('/v1/agenda', { params: { de, ate } }).then((r) => r.data),
  create: (body: AgendamentoCreate) =>
    api.post<Agendamento>('/v1/agenda', body).then((r) => r.data),
  update: (a: Agendamento, body: Partial<AgendamentoCreate>) =>
    api.put<Agendamento>(`/v1/agenda/${tsId(a)}`, body).then((r) => r.data),
  setStatus: (a: Agendamento, status: AgendamentoStatus) =>
    api.post<Agendamento>(`/v1/agenda/${tsId(a)}/status`, null, { params: { status } }).then((r) => r.data),
  remove: (a: Agendamento) => api.delete(`/v1/agenda/${tsId(a)}`),
}
