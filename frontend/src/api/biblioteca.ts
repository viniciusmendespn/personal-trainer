import { api } from './client'
import type { ExLib } from '../types'

export interface ExLibCreate {
  nome: string
  grupo?: string
  video_url?: string
  descricao?: string
  recomendacoes?: string
}

export const bibliotecaApi = {
  list: () => api.get<ExLib[]>('/v1/biblioteca/exercicios').then((r) => r.data),
  create: (body: ExLibCreate) => api.post<ExLib>('/v1/biblioteca/exercicios', body).then((r) => r.data),
  update: (id: string, body: ExLibCreate) =>
    api.put<ExLib>(`/v1/biblioteca/exercicios/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/v1/biblioteca/exercicios/${id}`),
}
