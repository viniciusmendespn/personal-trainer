import { useEffect, useState } from 'react'
import { pushApi } from '../api/push'

const LS_KEY = 'pt_push_subscribed'

export function usePushNotification() {
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then(async (sub) => {
        const storedFlag = localStorage.getItem(LS_KEY) === '1'
        if (sub && storedFlag) {
          setIsSubscribed(true)
        } else if (sub && !storedFlag) {
          // Sub existe no browser mas não foi salva no backend — re-registrar silenciosamente
          try {
            await pushApi.subscribe(sub.toJSON() as PushSubscriptionJSON)
            localStorage.setItem(LS_KEY, '1')
            setIsSubscribed(true)
          } catch { /* best-effort */ }
        } else if (!sub && storedFlag) {
          localStorage.removeItem(LS_KEY)
        }
      })
    })
  }, [])

  async function requestAndSubscribe(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      // Timeout apenas na chamada de rede (cold start de Lambda)
      const vapidKey = await Promise.race<string>([
        pushApi.getVapidKey(),
        new Promise<string>((_, rej) =>
          setTimeout(() => rej(new Error('push:timeout')), 15_000)
        ),
      ])
      if (!vapidKey) throw new Error('push:vapid-key-empty')

      const timeout = <T>(ms: number, label: string, p: Promise<T>): Promise<T> =>
        Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`push:timeout:${label}:${ms}ms`)), ms))])

      const reg = await timeout(8_000, 'sw-ready', navigator.serviceWorker.ready)

      // Sempre remove subscription existente para evitar conflito de chave VAPID
      const existing = await timeout(5_000, 'getSubscription', reg.pushManager.getSubscription())
      if (existing) {
        try { await timeout(5_000, 'unsubscribe', existing.unsubscribe()) } catch { /* ignora */ }
      }

      let sub: PushSubscription
      try {
        sub = await timeout(15_000, 'subscribe', reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        }))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const name = e instanceof DOMException ? e.name : 'unknown'
        await pushApi.reportError(`pushManager.subscribe falhou: ${name}`, msg)
        throw e
      }

      await pushApi.subscribe(sub.toJSON() as PushSubscriptionJSON)
      localStorage.setItem(LS_KEY, '1')
      setIsSubscribed(true)
    } catch (e) {
      console.error('[push:aluno] falha ao inscrever:', e)
      throw e
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!('serviceWorker' in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await pushApi.unsubscribe(sub.endpoint)
        await sub.unsubscribe()
      }
      localStorage.removeItem(LS_KEY)
      setIsSubscribed(false)
    } catch { /* best-effort */ }
  }

  return { isSubscribed, requestAndSubscribe, unsubscribe }
}
