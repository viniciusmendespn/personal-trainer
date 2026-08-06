import { useCallback, useEffect, useState } from 'react'
import { pushPersonalApi } from '../api/push'

const LS_KEY = 'pt_push_personal_subscribed'
const LS_PERM_KEY = 'pt_push_personal_perm_granted'

async function report(step: string, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err)
  const detail = `ua=${navigator.userAgent.slice(0, 120)} perm=${Notification.permission}`
  console.error(`[push:personal] ${step}:`, msg)
  await pushPersonalApi.reportError(`${step}: ${msg}`, detail).catch(() => {})
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
  const opts: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  }
  let sub: PushSubscription
  try {
    sub = await reg.pushManager.subscribe(opts)
  } catch (e) {
    // InvalidStateError = já existe subscription com outra applicationServerKey (rotação de
    // VAPID). Sem descartar a antiga o usuário fica travado sem push para sempre.
    if (!(e instanceof DOMException) || e.name !== 'InvalidStateError') throw e
    const antiga = await reg.pushManager.getSubscription()
    await antiga?.unsubscribe()
    sub = await reg.pushManager.subscribe(opts)
  }
  await pushPersonalApi.subscribe(sub.toJSON() as PushSubscriptionJSON)
  localStorage.setItem(LS_KEY, '1')
}

function currentPermission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied'
}

export function usePushPersonal() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>(currentPermission)
  const [subs, setSubs] = useState<number | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      setSubs((await pushPersonalApi.status()).subs)
    } catch { /* best-effort */ }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      const storedFlag = localStorage.getItem(LS_KEY) === '1'
      const permGranted = localStorage.getItem(LS_PERM_KEY) === '1'

      if (sub) {
        // Reafirmar SEMPRE no backend, mesmo com a flag local setada. O backend remove a
        // subscription quando o push service devolve 404/410, e antes disso o cliente nunca
        // reenviava — o personal via "notificações ativadas" e não recebia mais nada.
        // PutItem idempotente (chave = hash do endpoint): 1 write por carga do portal.
        try {
          await pushPersonalApi.subscribe(sub.toJSON() as PushSubscriptionJSON)
          localStorage.setItem(LS_KEY, '1')
        } catch { /* best-effort */ }
        setIsSubscribed(true)
        return
      }
      if (storedFlag) {
        localStorage.removeItem(LS_KEY)
      }
      // Permissão já concedida antes mas subscription sumiu (ex.: rotação de chave VAPID)
      if (permGranted && Notification.permission === 'granted') {
        try {
          const vapidKey = await pushPersonalApi.getVapidKey()
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
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      // Registra que houve consentimento — o useEffect re-tenta a inscrição em cargas
      // futuras mesmo se a subscription se perder.
      localStorage.setItem(LS_PERM_KEY, '1')

      const vapidKey = await pushPersonalApi.getVapidKey()
      const reg = await navigator.serviceWorker.ready
      await doSubscribe(vapidKey, reg)
      setIsSubscribed(true)
      await refreshStatus()
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
        await pushPersonalApi.unsubscribe(sub.endpoint)
        await sub.unsubscribe()
      }
      localStorage.removeItem(LS_KEY)
      localStorage.removeItem(LS_PERM_KEY)
      setIsSubscribed(false)
      setPermission(currentPermission())
      await refreshStatus()
    } catch (e) {
      await report('unsubscribe', e)
    }
  }

  return { isSubscribed, permission, subs, refreshStatus, requestAndSubscribe, unsubscribe }
}
