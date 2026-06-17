import { api } from './client'
import type { ChatMensagem } from '../types'

export interface ChatPage {
  items: ChatMensagem[]
  next_cursor: string | null
}

export const personalChatApi = {
  history: (alunoId: string, params: { cursor?: string; limit?: number } = {}) =>
    api.get<ChatPage>(`/v1/alunos/${alunoId}/chat`, { params }).then((r) => r.data),
  send: (alunoId: string, text: string) =>
    api.post<{ reply: string }>(`/v1/alunos/${alunoId}/chat`, { text }).then((r) => r.data),
}
