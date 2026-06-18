import { alunoClient } from './alunoClient'
import type { ChatMensagem } from '../types'

export interface ChatPage {
  items: ChatMensagem[]
  next_cursor: string | null
  agente_pausado?: boolean
}

export const alunoChatApi = {
  history: (params: { cursor?: string; limit?: number } = {}) =>
    alunoClient.get<ChatPage>('/v1/aluno/chat', { params }).then((r) => r.data),
  send: (text: string) =>
    alunoClient.post<{ reply: string }>('/v1/aluno/chat', { text }).then((r) => r.data),
  sendDireto: (text: string) =>
    alunoClient.post('/v1/aluno/chat/personal', { text }).then((r) => r.data),
}
