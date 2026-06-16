import { api } from './client'
import type { TreinoTemplate, TreinoTemplateCreate } from '../types'

export const templatesApi = {
  list: () => api.get<TreinoTemplate[]>('/v1/templates').then((r) => r.data),
  create: (body: TreinoTemplateCreate) =>
    api.post<TreinoTemplate>('/v1/templates', body).then((r) => r.data),
  createFromTreino: (alunoId: string, treinoId: string, nome?: string) =>
    api.post<TreinoTemplate>('/v1/templates/from-treino', { aluno_id: alunoId, treino_id: treinoId, nome })
      .then((r) => r.data),
  update: (id: string, body: TreinoTemplateCreate) =>
    api.put<TreinoTemplate>(`/v1/templates/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/v1/templates/${id}`),
  aplicar: (id: string, alunoIds: string[]) =>
    api.post<{ aplicados: { aluno_id: string; treino_id: string }[] }>(`/v1/templates/${id}/aplicar`, { aluno_ids: alunoIds })
      .then((r) => r.data),
}
