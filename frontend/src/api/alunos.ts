import { api } from './client'
import type { Aluno, AlunoCreate, AlunoStatus } from '../types'

export type AlunoUpdate = Partial<AlunoCreate> & { status?: AlunoStatus }

export const alunosApi = {
  list: () => api.get<Aluno[]>('/v1/alunos').then((r) => r.data),
  get: (id: string) => api.get<Aluno>(`/v1/alunos/${id}`).then((r) => r.data),
  create: (body: AlunoCreate) => api.post<Aluno>('/v1/alunos', body).then((r) => r.data),
  update: (id: string, body: AlunoUpdate) =>
    api.put<Aluno>(`/v1/alunos/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/v1/alunos/${id}`),
}
