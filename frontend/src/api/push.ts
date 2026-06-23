import { api } from './client'
import { alunoClient } from './alunoClient'

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
}
