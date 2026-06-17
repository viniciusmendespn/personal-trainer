import { api } from './client'
import type { Aluno, AlunoCreate, AlunoStatus } from '../types'

export type AlunoUpdate = Partial<AlunoCreate> & { status?: AlunoStatus }

export interface AlunoPage {
  items: Aluno[]
  next_cursor: string | null
}

export const alunosApi = {
  list: (params: { cursor?: string; limit?: number } = {}) =>
    api.get<AlunoPage>('/v1/alunos', { params }).then((r) => r.data),
  get: (id: string) => api.get<Aluno>(`/v1/alunos/${id}`).then((r) => r.data),
  create: (body: AlunoCreate) => api.post<Aluno>('/v1/alunos', body).then((r) => r.data),
  update: (id: string, body: AlunoUpdate) =>
    api.put<Aluno>(`/v1/alunos/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/v1/alunos/${id}`),
  enviarLink: (id: string) =>
    api.post<{ link: string; enviado: boolean }>(`/v1/alunos/${id}/enviar-link`).then((r) => r.data),
  gerarLink: (id: string) =>
    api.get<{ link: string }>(`/v1/alunos/${id}/link`).then((r) => r.data),
}
