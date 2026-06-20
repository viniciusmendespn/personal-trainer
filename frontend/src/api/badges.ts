import { api } from './client'
import { alunoClient } from './alunoClient'

export interface Badge {
  tipo: string
  titulo: string
  descricao: string
  emoji: string
  categoria: string
  unlocked: boolean
  unlocked_at?: string
}

export const badgesApi = {
  list: (alunoId: string) =>
    api.get<Badge[]>(`/v1/alunos/${alunoId}/badges`).then((r) => r.data),
}

export const alunoBadgesApi = {
  list: () => alunoClient.get<Badge[]>('/v1/aluno/badges').then((r) => r.data),
}
