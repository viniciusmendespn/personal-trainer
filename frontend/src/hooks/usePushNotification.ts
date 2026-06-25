import { useEffect, useState } from 'react'
import { pushApi } from '../api/push'

const LS_KEY = 'pt_push_subscribed'
const LS_PERM_KEY = 'pt_push_perm_granted'

async function report(step: string, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err)
  const detail = `ua=${navigator.userAgent.slice(0, 120)} perm=${Notification.permission}`
  console.error(`[push:aluno] ${step}:`, msg)
  await pushApi.reportError(`${step}: ${msg}`, detail).catch(() => {})
}

// iOS Safari exige applicationServerKey como BufferSource (Uint8Array); a string base64url
// pura falha. Converter sempre garante Android + iOS.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function doSubscribe(vapidKey: string, reg: ServiceWorkerRegistration): Promise<void> {
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })
  await pushApi.subscribe(sub.toJSON() as PushSubscriptionJSON)
  localStorage.setItem(LS_KEY, '1')
}

function currentPermission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied'
}

export function usePushNotification() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>(currentPermission)

  // Quando SW ficar pronto (pode demorar no primeiro uso), tenta inscrever automaticamente
  // se o usuário já tinha concedido permissão numa tentativa anterior.
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      const storedFlag = localStorage.getItem(LS_KEY) === '1'
      const permGranted = localStorage.getItem(LS_PERM_KEY) === '1'

      if (sub && storedFlag) {
        setIsSubscribed(true)
        return
      }
      if (sub && !storedFlag) {
        // Subscription existe no browser mas não foi salva no backend — re-registrar
        try {
          const vapidKey = await pushApi.getVapidKey()
          await doSubscribe(vapidKey, reg)
          setIsSubscribed(true)
        } catch { /* best-effort */ }
        return
      }
      if (!sub && storedFlag) {
        localStorage.removeItem(LS_KEY)
      }
      // Se permissão já foi concedida mas subscription não existe, inscrever agora
      if (!sub && permGranted && Notification.permission === 'granted') {
        try {
          const vapidKey = await pushApi.getVapidKey()
          await doSubscribe(vapidKey, reg)
          setIsSubscribed(true)
        } catch (e) {
          await report('auto-subscribe', e)
        }
      }
    })
  }, [])

  async function requestAndSubscribe(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const permission = await Notification.requestPermission()
      setPermission(permission)
      if (permission !== 'granted') return

      // Salvar que o usuário concedeu permissão — o useEffect re-tenta a inscrição
      // (ex.: rotação de chave VAPID) mesmo em cargas futuras.
      localStorage.setItem(LS_PERM_KEY, '1')

      const vapidKey = await pushApi.getVapidKey()

      // O SW agora instala em ms (precache vazio), então ready resolve rápido. Inscrever
      // direto pela registration de ready elimina a corrida com serviceWorker.controller.
      const reg = await navigator.serviceWorker.ready
      await doSubscribe(vapidKey, reg)
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
      localStorage.removeItem(LS_PERM_KEY)
      setIsSubscribed(false)
      setPermission(currentPermission())
    } catch { /* best-effort */ }
  }

  return { isSubscribed, permission, requestAndSubscribe, unsubscribe }
}
