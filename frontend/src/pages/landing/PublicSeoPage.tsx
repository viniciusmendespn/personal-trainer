import { Suspense, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import LandingFooter from './LandingFooter'
import { WIDGETS } from './calculadoras/registry'
import { renderInline, ProseList, ProseTable } from './prose'
import { BASE_URL, PAGES } from './publicSeoData.js'
import type { PageKey, SeoPage } from './publicSeoData.js'

const LABELS: Record<PageKey, string> = Object.fromEntries(
  Object.entries(PAGES).map(([key, page]) => [key, page.label ?? page.h1.replace('CoachPilot vs ', 'Vs ')])
) as Record<PageKey, string>

function upsertMeta(selector: string, create: () => HTMLMetaElement | HTMLLinkElement, attr: string, value: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

// Espelha breadcrumbTrail() de scripts/prerender-public-pages.mjs — o par de
// JSON-LD (runtime x estático) precisa ser editado junto.
function breadcrumbTrail(page: SeoPage, canonical: string) {
  const trail: object[] = [{ '@type': 'ListItem', position: 1, name: 'CoachPilot', item: BASE_URL }]
  const parent = page.parent ? PAGES[page.parent] : null
  if (parent) {
    trail.push({ '@type': 'ListItem', position: 2, name: parent.label ?? parent.h1, item: `${BASE_URL}${parent.path}` })
  }
  trail.push({ '@type': 'ListItem', position: trail.length + 1, name: page.label ?? page.h1, item: canonical })
  return trail
}

function usePageMeta(page: SeoPage) {
  useEffect(() => {
    const canonical = `${BASE_URL}${page.path}`
    window.scrollTo(0, 0)
    document.title = page.title
    upsertMeta('meta[name="description"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('name', 'description')
      return el
    }, 'content', page.description)
    upsertMeta('link[rel="canonical"]', () => {
      const el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      return el
    }, 'href', canonical)
    upsertMeta('meta[property="og:title"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:title')
      return el
    }, 'content', page.title)
    upsertMeta('meta[property="og:description"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:description')
      return el
    }, 'content', page.description)
    upsertMeta('meta[property="og:url"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:url')
      return el
    }, 'content', canonical)

    const graph: object[] = [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: page.title,
        description: page.description,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${BASE_URL}/#website` },
        about: { '@id': `${BASE_URL}/#app` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: breadcrumbTrail(page, canonical),
      },
    ]
    // Espelha calculatorNode/itemListNode de scripts/prerender-public-pages.mjs.
    // WebApplication (subtipo de SoftwareApplication) para não colidir com o nó
    // global .../#app declarado no index.html.
    if (page.widget) {
      ;(graph[0] as Record<string, unknown>).mainEntity = { '@id': `${canonical}#calculator` }
      graph.push({
        '@type': 'WebApplication',
        '@id': `${canonical}#calculator`,
        name: page.label ?? page.h1,
        url: canonical,
        applicationCategory: page.appCategory ?? 'HealthApplication',
        operatingSystem: 'Web',
        browserRequirements: 'Requer JavaScript',
        inLanguage: 'pt-BR',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
        provider: { '@id': `${BASE_URL}/#organization` },
      })
    }
    if (page.index) {
      graph.push({
        '@type': 'ItemList',
        '@id': `${canonical}#lista`,
        itemListElement: page.index.map((key, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: PAGES[key].label ?? PAGES[key].h1,
          url: `${BASE_URL}${PAGES[key].path}`,
        })),
      })
    }
    if (page.faqs.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${canonical}#faq`,
        mainEntity: page.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      })
    }
    const schema = { '@context': 'https://schema.org', '@graph': graph }
    let script = document.querySelector('#page-json-ld') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'page-json-ld'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(schema)
  }, [page])
}

// Altura reservada: sem ela o chunk do widget chegando empurra bullets e seções
// para baixo, e o CLS estraga justamente na página de aquisição.
function CalcSkeleton() {
  return <div style={{ minHeight: 420, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0' }} />
}

function IndexCards({ keys }: { keys: PageKey[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
      {keys.map((key) => (
        <Link key={key} to={PAGES[key].path} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '22px 24px', display: 'block' }}>
          <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, color: '#0f172a', marginBottom: 8, lineHeight: 1.3 }}>{LABELS[key]}</h3>
          <p style={{ color: '#475569', fontSize: 14.5, lineHeight: 1.65 }}>{PAGES[key].description}</p>
        </Link>
      ))}
    </div>
  )
}

export function PublicSeoPage({ pageKey }: { pageKey: PageKey }) {
  const page = PAGES[pageKey]
  usePageMeta(page)
  const parent = page.parent ? PAGES[page.parent] : null
  const Widget = page.widget ? WIDGETS[page.widget] : null

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#0f172a' }}>
      <header style={{ background: '#060a14', borderBottom: '1px solid rgba(20,184,166,0.14)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" style={{ height: 52, width: 'auto' }} />
          </Link>
          <Link to={parent ? parent.path : '/'} style={{ color: 'rgba(255,255,255,0.74)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
            <ArrowLeft size={15} /> {parent ? (parent.label ?? 'Voltar') : 'Voltar'}
          </Link>
        </div>
      </header>

      <main>
        <section style={{ background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 55%, #060a14 100%)', padding: '72px 24px 64px' }}>
          <div style={{ maxWidth: 980, margin: '0 auto' }}>
            <p style={{ color: '#14b8a6', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 16 }}>
              {page.eyebrow ?? 'CoachPilot para personal trainers'}
            </p>
            <h1 style={{ fontFamily: "'Sora', sans-serif", color: '#fff', fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.1, maxWidth: 860, marginBottom: 20 }}>
              {page.h1}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 18, lineHeight: 1.7, maxWidth: 760, marginBottom: 32 }}>
              {page.intro}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #14b8a6, #10b981)', color: '#fff', textDecoration: 'none', fontWeight: 800, padding: '14px 22px', borderRadius: 10 }}>
                Começar grátis <ArrowRight size={18} />
              </Link>
              <Link to="/precos" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.86)', textDecoration: 'none', fontWeight: 700, padding: '13px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)' }}>
                Ver preços
              </Link>
            </div>
          </div>
        </section>

        {(Widget || page.index) && (
          <section id="calculadora" style={{ padding: '48px 24px 56px', background: '#f8fafc' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              {page.widgetTitle && (
                <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 26, marginBottom: 8 }}>{page.widgetTitle}</h2>
              )}
              {page.widgetNote && (
                <p style={{ color: '#475569', fontSize: 16, lineHeight: 1.7, marginBottom: 20 }}>{renderInline(page.widgetNote)}</p>
              )}
              {Widget && <Suspense fallback={<CalcSkeleton />}><Widget /></Suspense>}
              {page.index && <IndexCards keys={page.index} />}
            </div>
          </section>
        )}

        <section style={{ padding: '64px 24px', background: '#f8fafc' }}>
          <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {page.bullets.map((bullet) => (
              <div key={bullet} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <CheckCircle2 size={20} color="#14b8a6" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ color: '#334155', fontWeight: 650, lineHeight: 1.45 }}>{bullet}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '64px 24px', background: '#fff' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: 28 }}>
            {page.sections.map((section) => {
              const paragraphs = section.paragraphs ?? (section.body ? [section.body] : [])
              return (
                <article key={section.title}>
                  <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 26, marginBottom: 10 }}>{section.title}</h2>
                  {paragraphs.map((paragraph, i) => (
                    // margem só entre parágrafos: preserva o espaçamento das páginas de 1 parágrafo
                    <p key={i} style={{ color: '#475569', fontSize: 16, lineHeight: 1.75, marginBottom: i === paragraphs.length - 1 ? 0 : 12 }}>
                      {renderInline(paragraph)}
                    </p>
                  ))}
                  {section.list && <ProseList items={section.list} />}
                  {section.table && <ProseTable table={section.table} />}
                </article>
              )
            })}
          </div>
        </section>

        {page.faqs.length > 0 && (
          <section style={{ padding: '64px 24px', background: '#f0fdfa' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 30, marginBottom: 24 }}>Perguntas frequentes</h2>
              <div style={{ display: 'grid', gap: 14 }}>
                {page.faqs.map((faq) => (
                  <article key={faq.q} style={{ background: '#fff', border: '1px solid rgba(20,184,166,0.18)', borderRadius: 12, padding: 22 }}>
                    <h3 style={{ fontSize: 17, marginBottom: 8 }}>{faq.q}</h3>
                    <p style={{ color: '#475569', lineHeight: 1.7 }}>{faq.a}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section style={{ padding: '56px 24px', background: '#fff' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 24, marginBottom: 18 }}>Também pode ajudar</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {page.related.map((key) => (
                <Link key={key} to={PAGES[key].path} style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 700, background: '#f0fdfa', border: '1px solid rgba(20,184,166,0.22)', borderRadius: 999, padding: '10px 14px' }}>
                  {LABELS[key]}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
