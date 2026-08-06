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

      if (sub) {
        // Reafirmar SEMPRE no backend, mesmo com a flag local setada. O backend remove a
        // subscription quando o push service devolve 404/410, e antes disso o cliente nunca
        // reenviava — o usuário via "notificações ativadas" e não recebia mais nada.
        // PutItem idempotente (chave = hash do endpoint): 1 write por carga do app.
        try {
          await pushApi.subscribe(sub.toJSON() as PushSubscriptionJSON)
          localStorage.setItem(LS_KEY, '1')
        } catch { /* best-effort */ }
        setIsSubscribed(true)
        return
      }
      if (storedFlag) {
        localStorage.removeItem(LS_KEY)
      }
      // Se permissão já foi concedida mas subscription não existe, inscrever agora
      if (permGranted && Notification.permission === 'granted') {
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
