import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & typeof globalThis

// Registrado ANTES do precacheAndRoute para ter prioridade sobre o cleanURLs
// que mapearia / → /index.html (bundle do portal) em vez de /aluno.html.
if (self.location.hostname.startsWith('app.')) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('/aluno.html')))
}

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
