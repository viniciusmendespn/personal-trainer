import { useEffect, useState } from 'react'
import { pushApi } from '../api/push'

const LS_KEY = 'pt_push_subscribed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

async function report(step: string, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof DOMException ? err.name : (err instanceof Error ? err.constructor.name : 'unknown')
  const detail = `ua=${navigator.userAgent.slice(0, 120)} perm=${Notification.permission}`
  console.error(`[push:aluno] ${step}:`, name, msg)
  await pushApi.reportError(`${step}: ${name}: ${msg}`, detail)
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

      const timeout = <T>(ms: number, label: string, p: Promise<T>): Promise<T> =>
        Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`push:timeout:${label}:${ms}ms`)), ms))])

      let vapidKeyRaw: string
      try {
        vapidKeyRaw = await timeout(15_000, 'vapid-key', pushApi.getVapidKey())
        if (!vapidKeyRaw) throw new Error('push:vapid-key-empty')
      } catch (e) {
        await report('vapid-key', e)
        throw e
      }

      // Converte para Uint8Array — obrigatório em iOS/Safari; cast para satisfazer TS
      const applicationServerKey = urlBase64ToUint8Array(vapidKeyRaw).buffer as ArrayBuffer

      let reg: ServiceWorkerRegistration
      try {
        reg = await timeout(8_000, 'sw-ready', navigator.serviceWorker.ready)
      } catch (e) {
        await report('sw-ready', e)
        throw e
      }

      // Remove subscription existente para evitar conflito de chave VAPID
      try {
        const existing = await timeout(5_000, 'getSubscription', reg.pushManager.getSubscription())
        if (existing) {
          await timeout(5_000, 'unsubscribe', existing.unsubscribe()).catch(() => {})
        }
      } catch { /* ignora — prossegue para subscribe */ }

      let sub: PushSubscription
      try {
        sub = await timeout(20_000, 'subscribe', reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }))
      } catch (e) {
        await report('pushManager.subscribe', e)
        throw e
      }

      const subJson = sub.toJSON() as PushSubscriptionJSON
      if (!subJson.keys?.p256dh || !subJson.keys?.auth) {
        await report('subscribe-keys', new Error(`keys ausentes: p256dh=${subJson.keys?.p256dh} auth=${subJson.keys?.auth}`))
        throw new Error('push:subscription-keys-missing')
      }

      try {
        await pushApi.subscribe(subJson)
      } catch (e) {
        await report('pushApi.subscribe', e)
        throw e
      }

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
