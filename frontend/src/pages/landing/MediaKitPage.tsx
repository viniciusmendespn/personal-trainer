import { useEffect } from 'react'
import MediaKitLayout from './MediaKitLayout'
import { MEDIA_KIT } from './mediaKitData.js'
import { BASE_URL } from './publicSeoData.js'

const CANONICAL = `${BASE_URL}${MEDIA_KIT.path}`
const OG_IMAGE = `${BASE_URL}/og-image.jpg`

// ── Analytics ────────────────────────────────────────────────────────────────
// GA4 já é carregado no index.html; aqui só disparamos os eventos da página.
// Se o script estiver bloqueado (adblock), gtag não existe e o clique segue normal.
type Gtag = (command: 'event', name: string, params?: Record<string, unknown>) => void

function track(event: string, params?: Record<string, unknown>) {
  ;(window as unknown as { gtag?: Gtag }).gtag?.('event', event, params)
}

/** Origem do parceiro que recebeu o link (?utm_source=casa_do_fitness&...). */
function partnerSource(): string | undefined {
  const utm = new URLSearchParams(window.location.search).get('utm_source')
  return utm ?? undefined
}

// ── Meta / JSON-LD ───────────────────────────────────────────────────────────
function upsert(selector: string, create: () => HTMLMetaElement | HTMLLinkElement, attr: string, value: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

const meta = (name: string, prop: 'name' | 'property') => () => {
  const el = document.createElement('meta')
  el.setAttribute(prop, name)
  return el
}

/** Espelha mediaKitSchema() de scripts/prerender-public-pages.mjs — editar os dois juntos. */
function schemaGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${CANONICAL}#webpage`,
        url: CANONICAL,
        name: MEDIA_KIT.title,
        description: MEDIA_KIT.description,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${BASE_URL}/#website` },
        about: { '@id': `${BASE_URL}/#app` },
        publisher: { '@id': `${BASE_URL}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${CANONICAL}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'CoachPilot', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Mídia Kit', item: CANONICAL },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${CANONICAL}#faq`,
        mainEntity: MEDIA_KIT.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }
}

function usePageMeta() {
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = MEDIA_KIT.title
    upsert('meta[name="description"]', meta('description', 'name'), 'content', MEDIA_KIT.description)
    upsert('link[rel="canonical"]', () => {
      const el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      return el
    }, 'href', CANONICAL)
    upsert('meta[property="og:type"]', meta('og:type', 'property'), 'content', 'website')
    upsert('meta[property="og:title"]', meta('og:title', 'property'), 'content', MEDIA_KIT.title)
    upsert('meta[property="og:description"]', meta('og:description', 'property'), 'content', MEDIA_KIT.description)
    upsert('meta[property="og:url"]', meta('og:url', 'property'), 'content', CANONICAL)
    upsert('meta[property="og:image"]', meta('og:image', 'property'), 'content', OG_IMAGE)
    upsert('meta[name="twitter:title"]', meta('twitter:title', 'name'), 'content', MEDIA_KIT.title)
    upsert('meta[name="twitter:description"]', meta('twitter:description', 'name'), 'content', MEDIA_KIT.description)

    let script = document.querySelector('#page-json-ld') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'page-json-ld'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(schemaGraph())

    track('media_kit_view', { partner_source: partnerSource() ?? '(direto)' })

    return () => {
      document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${BASE_URL}/`)
    }
  }, [])
}

export function MediaKitPage() {
  usePageMeta()
  return <MediaKitLayout track={track} />
}
