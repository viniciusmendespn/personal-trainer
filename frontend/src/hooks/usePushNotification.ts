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

      const reg = await navigator.serviceWorker.ready

      let sub: PushSubscription
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        })
      } catch (e) {
        // Após rotação de chave VAPID: subscription existente com outra key → unsubscribe + retry
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
          const existing = await reg.pushManager.getSubscription()
          if (existing) await existing.unsubscribe()
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey,
          })
        } else {
          throw e
        }
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
