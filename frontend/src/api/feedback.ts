import { api } from './client'

export const feedbackApi = {
  enviar: (mensagem: string) =>
    api.post<{ ok: number; feedback_id: string }>('/v1/feedback', { mensagem }).then((r) => r.data),
}
