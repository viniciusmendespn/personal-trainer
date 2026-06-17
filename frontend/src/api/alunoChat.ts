import { alunoClient } from './alunoClient'
import type { ChatMensagem } from '../types'

export const alunoChatApi = {
  history: (limit = 50) =>
    alunoClient.get<ChatMensagem[]>('/v1/aluno/chat', { params: { limit } }).then((r) => r.data),
  send: (text: string) =>
    alunoClient.post<{ reply: string }>('/v1/aluno/chat', { text }).then((r) => r.data),
}
