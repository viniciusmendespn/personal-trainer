import { api } from './client'
import type { Avaliacao } from '../types'

export interface AvaliacaoCreate {
  data?: string
  peso?: number
  altura_cm?: number
  percentual_gordura?: number
  observacoes?: string
}

export const avaliacoesApi = {
  list: (alunoId: string) =>
    api.get<Avaliacao[]>(`/v1/alunos/${alunoId}/avaliacoes`).then((r) => r.data),
  create: (alunoId: string, body: AvaliacaoCreate) =>
    api.post<Avaliacao>(`/v1/alunos/${alunoId}/avaliacoes`, body).then((r) => r.data),
}
