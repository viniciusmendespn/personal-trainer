import { api } from './client'
import { alunoClient } from './alunoClient'

/** Verdade do backend sobre quantos dispositivos estão registrados de fato. */
export interface PushStatus {
  subs: number
  vapid_ok: boolean
}

/** Resumo de um envio: quantos dispositivos receberam, quantos foram removidos, quantos falharam. */
export interface PushResumo {
  enviados: number
  removidos: number
  falhas: number
}

export const pushApi = {
  async getVapidKey(): Promise<string> {
    const res = await alunoClient.get<{ public_key: string }>('/v1/aluno/push/vapid-key')
    return res.data.public_key
  },

  async subscribe(sub: PushSubscriptionJSON): Promise<void> {
    await alunoClient.post('/v1/aluno/push/subscribe', {
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh ?? '',
      auth: sub.keys?.auth ?? '',
    })
  },

  async unsubscribe(endpoint: string): Promise<void> {
    await alunoClient.delete('/v1/aluno/push/subscribe', { data: { endpoint } })
  },

  async reportError(message: string, detail?: string): Promise<void> {
    await alunoClient.post('/v1/aluno/push/error', { message, detail }).catch(() => {})
  },

  async status(): Promise<PushStatus> {
    const res = await alunoClient.get<PushStatus>('/v1/aluno/push/status')
    return res.data
  },

  async test(): Promise<PushResumo> {
    const res = await alunoClient.post<PushResumo>('/v1/aluno/push/test')
    return res.data
  },
}

export const pushPersonalApi = {
  async getVapidKey(): Promise<string> {
    const res = await api.get<{ public_key: string }>('/v1/personal/push/vapid-key')
    return res.data.public_key
  },

  async subscribe(sub: PushSubscriptionJSON): Promise<void> {
    await api.post('/v1/personal/push/subscribe', {
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh ?? '',
      auth: sub.keys?.auth ?? '',
    })
  },

  async unsubscribe(endpoint: string): Promise<void> {
    await api.delete('/v1/personal/push/subscribe', { data: { endpoint } })
  },

  async reportError(message: string, detail?: string): Promise<void> {
    await api.post('/v1/personal/push/error', { message, detail }).catch(() => {})
  },

  async status(): Promise<PushStatus> {
    const res = await api.get<PushStatus>('/v1/personal/push/status')
    return res.data
  },

  async test(): Promise<PushResumo> {
    const res = await api.post<PushResumo>('/v1/personal/push/test')
    return res.data
  },
}
