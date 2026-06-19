import { api } from './client'
import type { ChatMensagem } from '../types'

export interface ChatPage {
  items: ChatMensagem[]
  next_cursor: string | null
  agente_habilitado?: boolean
}

export const personalChatApi = {
  history: (alunoId: string, params: { cursor?: string; limit?: number } = {}) =>
    api.get<ChatPage>(`/v1/alunos/${alunoId}/chat`, { params }).then((r) => r.data),
  send: (alunoId: string, text: string) =>
    api.post<{ ok: number }>(`/v1/alunos/${alunoId}/chat`, { text }).then((r) => r.data),
  setAgenteHabilitado: (alunoId: string, habilitado: boolean) =>
    api.patch<{ ok: number; agente_habilitado: boolean }>(`/v1/alunos/${alunoId}/chat/agente`, { habilitado }).then((r) => r.data),
}
