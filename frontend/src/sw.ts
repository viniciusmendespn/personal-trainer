import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & typeof globalThis

// Precache vazio (globPatterns: [] em vite.config) — no-op. A referência a self.__WB_MANIFEST
// é exigida pelo injectManifest do vite-plugin-pwa. A navegação SPA é resolvida pelo CloudFront
// (default root object + custom error pages 403/404), não pelo SW — por isso não há NavigationRoute
// aqui: createHandlerBoundToURL exige a URL no precache e, com precache vazio, lançava
// WorkboxError('non-precached-url') no topo do script, abortando a instalação do SW.
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title: string = data.title ?? 'CoachPilot'
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: '/icon-192.png',
    badge: '/badge-icon.png',
    tag: (data.tag as string | undefined) ?? 'coachpilot',
    data: { url: data.url ?? '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl: string = (event.notification.data as { url?: string })?.url ?? '/aluno'
  const absoluteUrl = rawUrl.startsWith('http') ? rawUrl : self.location.origin + rawUrl
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (windowClients) => {
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            await client.navigate(absoluteUrl)
            return client.focus()
          }
        }
        return clients.openWindow(absoluteUrl)
      })
  )
})
