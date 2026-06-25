import { useEffect, useState } from 'react'
import { pushApi } from '../api/push'

const LS_KEY = 'pt_push_subscribed'

async function report(step: string, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err)
  const detail = `ua=${navigator.userAgent.slice(0, 120)} perm=${Notification.permission}`
  console.error(`[push:aluno] ${step}:`, msg)
  await pushApi.reportError(`${step}: ${msg}`, detail).catch(() => {})
}

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

      const vapidKey = await pushApi.getVapidKey()

      const hasController = !!navigator.serviceWorker.controller
      await pushApi.reportError(
        `sw-state: controller=${hasController}`,
        `ua=${navigator.userAgent.slice(0, 80)}`
      ).catch(() => {})

      let reg: ServiceWorkerRegistration
      if (hasController) {
        reg = (await navigator.serviceWorker.getRegistration()) as ServiceWorkerRegistration
      } else {
        // Primeira instalação — SW ainda precacheia ~2.7MB. Aguardar sem timeout.
        reg = await navigator.serviceWorker.ready
      }

      await pushApi.reportError('sw-ready-ok', `active=${!!reg?.active}`).catch(() => {})

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })
      await pushApi.subscribe(sub.toJSON() as PushSubscriptionJSON)
      localStorage.setItem(LS_KEY, '1')
      setIsSubscribed(true)
    } catch (e) {
      await report('requestAndSubscribe', e)
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
