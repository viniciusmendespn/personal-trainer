import { useEffect, useState } from 'react'
import { pushApi } from '../api/push'

const LS_KEY = 'pt_push_subscribed'

function withTimeout<T>(ms: number, p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`push:timeout:${ms}ms`)), ms)
    ),
  ])
}

async function doSubscribe(reg: ServiceWorkerRegistration, vapidKey: string): Promise<void> {
  let sub: PushSubscription
  try {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })
  } catch (e) {
    // Pós-rotação de chave VAPID: subscription existente com outra key → unsubscribe + retry
    if (e instanceof DOMException && e.name === 'InvalidStateError') {
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })
    } else {
      throw e
    }
  }
  await pushApi.subscribe(sub.toJSON() as PushSubscriptionJSON)
}

export function usePushNotification() {
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        const storedFlag = localStorage.getItem(LS_KEY) === '1'
        if (sub && storedFlag) setIsSubscribed(true)
        else if (!sub && storedFlag) localStorage.removeItem(LS_KEY)
      })
    })
  }, [])

  // Para o useEffect de AlunoApp: só executa se permissão já concedida, nunca exibe prompt
  async function ensureSubscribedIfGranted(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission !== 'granted') return
    const vapidKey = await withTimeout(10_000, pushApi.getVapidKey())
    if (!vapidKey) throw new Error('push:vapid-key-empty')
    const reg = await withTimeout(10_000, navigator.serviceWorker.ready)
    await doSubscribe(reg, vapidKey)
    localStorage.setItem(LS_KEY, '1')
    setIsSubscribed(true)
  }

  // Para o botão "Ativar": pode exibir prompt (requer gesto do usuário)
  async function requestPermissionAndSubscribe(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('push:permission-denied')
    await ensureSubscribedIfGranted()
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

  return { isSubscribed, ensureSubscribedIfGranted, requestPermissionAndSubscribe, unsubscribe }
}
