import { api } from './client'
import type { ChatMensagem } from '../types'

export const personalChatApi = {
  history: (alunoId: string, limit = 50) =>
    api.get<ChatMensagem[]>(`/v1/alunos/${alunoId}/chat`, { params: { limit } }).then((r) => r.data),
  send: (alunoId: string, text: string) =>
    api.post<{ reply: string }>(`/v1/alunos/${alunoId}/chat`, { text }).then((r) => r.data),
}
