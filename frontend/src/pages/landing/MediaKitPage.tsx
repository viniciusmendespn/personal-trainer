import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronUp, Instagram, MessageCircle, Sparkles,
} from 'lucide-react'
import LandingFooter from './LandingFooter'
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

// ── Blocos visuais ───────────────────────────────────────────────────────────
const TEAL = '#14b8a6'
const GRAD = 'linear-gradient(135deg, #14b8a6, #10b981)'
const SORA = "'Sora', sans-serif"

function SectionTitle({ eyebrow, titulo, sub, dark }: { eyebrow?: string; titulo: string; sub?: string; dark?: boolean }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 44 }}>
      {eyebrow && (
        <div style={{ display: 'inline-block', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 20, padding: '5px 14px', marginBottom: 16 }}>
          <span style={{ color: dark ? TEAL : '#0d9488', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{eyebrow}</span>
        </div>
      )}
      <h2 style={{ fontFamily: SORA, fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: dark ? '#fff' : '#0f172a', letterSpacing: '-0.5px', marginBottom: sub ? 14 : 0, lineHeight: 1.2 }}>
        {titulo}
      </h2>
      {sub && (
        <p style={{ color: dark ? 'rgba(255,255,255,0.62)' : '#475569', fontSize: 16, lineHeight: 1.7, maxWidth: 620, margin: '0 auto' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

/** Botão que serve tanto para rota interna (Link) quanto para link externo, sempre com evento. */
function CtaButton({ href, label, event, variant = 'solid', icon }: {
  href: string
  label: string
  event?: string
  variant?: 'solid' | 'outline' | 'light'
  icon?: React.ReactNode
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontWeight: 700, fontSize: 16, textDecoration: 'none',
    padding: '14px 26px', borderRadius: 12, lineHeight: 1.2,
  }
  const style: React.CSSProperties = variant === 'solid'
    ? { ...base, background: GRAD, color: '#fff', boxShadow: '0 8px 25px rgba(20,184,166,0.3)' }
    : variant === 'light'
      ? { ...base, background: '#fff', color: '#0d9488', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }
      : { ...base, background: 'transparent', border: '1.5px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.88)' }

  const onClick = () => event && track(event, { partner_source: partnerSource() ?? '(direto)' })
  const conteudo = <>{label} {icon ?? <ArrowRight size={18} />}</>

  if (href.startsWith('/')) {
    return <Link to={href} style={style} onClick={onClick}>{conteudo}</Link>
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" style={style} onClick={onClick}>{conteudo}</a>
}

/** Print do produto. Se o arquivo ainda não existe no bucket, some em vez de
 *  mostrar ícone quebrado — a página segue apresentável.
 *  `largo` ocupa a linha inteira; `retrato` é print de celular, que sem limite de
 *  largura viraria uma coluna de 1200px de altura ao lado dos prints de desktop. */
function Shot({ src, alt, legenda, largo, retrato }: {
  src: string; alt: string; legenda: string; largo?: boolean; retrato?: boolean
}) {
  const [falhou, setFalhou] = useState(false)
  if (falhou) return null
  return (
    <figure style={{ margin: 0, gridColumn: largo ? '1 / -1' : 'auto', display: 'flex', flexDirection: 'column', alignItems: retrato ? 'center' : 'stretch' }}>
      <div style={{
        borderRadius: retrato ? 24 : 16, overflow: 'hidden',
        border: '1px solid rgba(20,184,166,0.18)', background: '#0b1220',
        boxShadow: '0 12px 40px rgba(2,6,23,0.35)',
        maxWidth: retrato ? 260 : '100%', width: '100%',
      }}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFalhou(true)}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>
      <figcaption style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, lineHeight: 1.6, marginTop: 10, textAlign: retrato ? 'center' : 'left', maxWidth: retrato ? 300 : undefined }}>
        {legenda}
      </figcaption>
    </figure>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [aberto, setAberto] = useState(false)
  return (
    <details
      open={aberto}
      onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}
      style={{ border: '1px solid rgba(20,184,166,0.16)', borderRadius: 12, background: '#fff', marginBottom: 10, overflow: 'hidden' }}
    >
      {/* listStyle none tira o triângulo nativo (e o ::-webkit-details-marker via
          list-style em navegadores atuais); o chevron abaixo é a afordância. */}
      <summary style={{ padding: '16px 20px', cursor: 'pointer', color: '#0f172a', fontWeight: 600, fontSize: 15, listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>{q}</span>
        {aberto ? <ChevronUp size={18} color={TEAL} style={{ flexShrink: 0 }} /> : <ChevronDown size={18} color="#94a3b8" style={{ flexShrink: 0 }} />}
      </summary>
      <p style={{ padding: '0 20px 16px', color: '#475569', fontSize: 14.5, lineHeight: 1.7 }}>{a}</p>
    </details>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────
export function MediaKitPage() {
  usePageMeta()
  const k = MEDIA_KIT

  return (
    <div style={{ fontFamily: SORA, background: '#fff', minHeight: '100vh' }}>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', height: 60 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex' }}>
            <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" style={{ height: 44, width: 'auto' }} />
          </Link>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: 14, textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}>
            <ArrowLeft size={14} /> Voltar ao site
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 50%, #060a14 100%)', position: 'relative', overflow: 'hidden', paddingTop: 60 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.12, backgroundImage: 'radial-gradient(rgba(20,184,166,0.6) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div style={{ position: 'absolute', top: '10%', left: '2%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.13) 0%, transparent 70%)', filter: 'blur(40px)' }} />

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '72px 20px 80px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 20, padding: '6px 14px', marginBottom: 24 }}>
            <Sparkles size={14} color={TEAL} />
            <span style={{ color: TEAL, fontSize: 13, fontWeight: 600 }}>{k.hero.eyebrow}</span>
          </div>

          <h1 style={{ fontFamily: SORA, fontSize: 'clamp(30px, 6vw, 54px)', fontWeight: 800, color: '#fff', lineHeight: 1.12, marginBottom: 20, letterSpacing: '-1px' }}>
            <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CoachPilot</span>
            {' — '}{k.hero.h1}
          </h1>

          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.66)', lineHeight: 1.75, maxWidth: 700, margin: '0 auto 34px' }}>
            {k.hero.subheadline}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            <CtaButton {...k.hero.ctaPrimario} />
            <CtaButton {...k.hero.ctaSecundario} variant="outline" icon={<MessageCircle size={18} />} />
          </div>

          {/* Métricas verificadas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 56 }}>
            {k.metricas.map((m) => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(20,184,166,0.18)', borderRadius: 14, padding: '20px 16px' }}>
                <div style={{ fontFamily: SORA, fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 800, color: '#fff', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 6 }}>{m.valor}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.5 }}>{m.label}</div>
              </div>
            ))}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5, lineHeight: 1.6, marginTop: 16, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            {k.metricasNota}
          </p>
        </div>
      </section>

      {/* ── O produto em 30 segundos ─────────────────────────────────────── */}
      <section style={{ background: '#fff', padding: '76px 20px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <SectionTitle eyebrow="O produto" titulo={k.resumo.titulo} sub={k.resumo.paragrafo} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {k.resumo.cards.map((c) => (
              <div key={c.titulo} style={{ background: '#f8fafc', border: '1.5px solid rgba(20,184,166,0.12)', borderRadius: 16, padding: 24 }}>
                <h3 style={{ fontFamily: SORA, fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{c.titulo}</h3>
                <p style={{ fontSize: 14.5, color: '#475569', lineHeight: 1.65 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Prova visual ─────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(160deg, #0f172a 0%, #060a14 100%)', padding: '76px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'radial-gradient(rgba(20,184,166,0.8) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <SectionTitle eyebrow="Prova visual" titulo={k.provaVisual.titulo} sub={k.provaVisual.intro} dark />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 26, alignItems: 'start' }}>
            {k.provaVisual.imagens.map((img) => <Shot key={img.src} {...img} />)}
          </div>
        </div>
      </section>

      {/* ── Público ──────────────────────────────────────────────────────── */}
      <section style={{ background: '#f0fdfa', padding: '76px 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <SectionTitle eyebrow="Audiência" titulo={k.publico.titulo} sub={k.publico.intro} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
            {k.publico.itens.map((p) => (
              <span key={p} style={{ background: '#fff', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 999, padding: '9px 16px', color: '#0f172a', fontSize: 14, fontWeight: 500 }}>
                {p}
              </span>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid rgba(20,184,166,0.18)', borderLeft: `4px solid ${TEAL}`, borderRadius: 12, padding: '18px 22px' }}>
            <p style={{ color: '#334155', fontSize: 14.5, lineHeight: 1.7 }}>{k.publico.nota}</p>
          </div>
        </div>
      </section>

      {/* ── Diferenciais ─────────────────────────────────────────────────── */}
      <section style={{ background: '#fff', padding: '76px 20px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <SectionTitle eyebrow="Diferenciais" titulo="O que separa o CoachPilot do resto" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            {k.diferenciais.map((d, i) => (
              <div key={d.titulo} style={{ border: '1.5px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(20,184,166,0.1)', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, marginBottom: 14 }}>
                  {i + 1}
                </div>
                <h3 style={{ fontFamily: SORA, fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8, lineHeight: 1.35 }}>{d.titulo}</h3>
                <p style={{ fontSize: 14.5, color: '#475569', lineHeight: 1.65 }}>{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Por que fazer parceria ───────────────────────────────────────── */}
      <section style={{ background: '#f8fafc', padding: '76px 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <SectionTitle eyebrow="Parceria" titulo={k.parceria.titulo} sub={k.parceria.paragrafo} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {k.parceria.beneficios.map((b) => (
              <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px' }}>
                <Check size={16} color={TEAL} style={{ marginTop: 3, flexShrink: 0 }} />
                <span style={{ color: '#334155', fontSize: 14.5, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Formatos de parceria ─────────────────────────────────────────── */}
      <section style={{ background: '#fff', padding: '76px 20px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <SectionTitle
            eyebrow="Formatos"
            titulo="Como a parceria funciona na prática"
            sub="O eixo é o cupom rastreável com comissão recorrente. O formato do conteúdo em volta dele é o que muda de parceiro para parceiro."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {k.formatos.map((f) => (
              <div
                key={f.titulo}
                style={{
                  borderRadius: 18, padding: 28,
                  background: f.destaque ? 'linear-gradient(160deg, #0f172a, #0d9488)' : '#f8fafc',
                  border: f.destaque ? '1.5px solid transparent' : '1.5px solid #e2e8f0',
                  gridColumn: f.destaque ? '1 / -1' : 'auto',
                }}
              >
                {f.destaque && (
                  <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
                    Formato principal
                  </span>
                )}
                <h3 style={{ fontFamily: SORA, fontSize: f.destaque ? 22 : 17, fontWeight: 700, color: f.destaque ? '#fff' : '#0f172a', marginBottom: 10, lineHeight: 1.3 }}>
                  {f.titulo}
                </h3>
                <p style={{ fontSize: 14.5, color: f.destaque ? 'rgba(255,255,255,0.75)' : '#475569', lineHeight: 1.7, marginBottom: 16, maxWidth: f.destaque ? 620 : undefined }}>
                  {f.desc}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: f.destaque ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr', gap: 8, marginBottom: f.cta ? 22 : 0 }}>
                  {f.itens.map((it) => (
                    <div key={it} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <Check size={14} color={f.destaque ? TEAL : '#0d9488'} style={{ marginTop: 3, flexShrink: 0 }} />
                      <span style={{ color: f.destaque ? 'rgba(255,255,255,0.8)' : '#475569', fontSize: 13.5, lineHeight: 1.55 }}>{it}</span>
                    </div>
                  ))}
                </div>
                {f.cta && <CtaButton {...f.cta} variant="light" />}
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, lineHeight: 1.6, marginTop: 22 }}>
            {k.formatosNota}
          </p>
        </div>
      </section>

      {/* ── Sinergia ─────────────────────────────────────────────────────── */}
      <section style={{ background: '#f0fdfa', padding: '76px 20px' }}>
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <SectionTitle eyebrow="Sinergia" titulo={k.sinergia.titulo} sub={k.sinergia.paragrafo} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {k.sinergia.colunas.map((c) => (
              <div key={c.titulo} style={{ background: '#fff', border: '1.5px solid rgba(20,184,166,0.15)', borderRadius: 16, padding: 26, textAlign: 'center' }}>
                <div style={{ color: '#0d9488', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>{c.titulo}</div>
                <p style={{ color: '#334155', fontSize: 14.5, lineHeight: 1.7 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Links oficiais ───────────────────────────────────────────────── */}
      <section style={{ background: '#fff', padding: '76px 20px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <SectionTitle eyebrow="Canais oficiais" titulo="Conheça o CoachPilot" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {k.links.map((l) => {
              const conteudo = (
                <>
                  <span style={{ display: 'block', color: '#64748b', fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>{l.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0f172a', fontSize: 15, fontWeight: 600, wordBreak: 'break-word' }}>
                    {l.valor} <ArrowUpRight size={15} color={TEAL} style={{ flexShrink: 0 }} />
                  </span>
                </>
              )
              const estilo: React.CSSProperties = { display: 'block', textDecoration: 'none', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }
              const onClick = () => l.event && track(l.event, { partner_source: partnerSource() ?? '(direto)' })
              return l.href.startsWith('/')
                ? <Link key={l.label} to={l.href} style={estilo} onClick={onClick}>{conteudo}</Link>
                : <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={estilo} onClick={onClick}>{conteudo}</a>
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section style={{ background: '#f8fafc', padding: '76px 20px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <SectionTitle eyebrow="Dúvidas" titulo="Perguntas frequentes de parceiros" />
          {k.faqs.map((f) => <FaqItem key={f.q} {...f} />)}
        </div>
      </section>

      {/* ── Contato ──────────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0d9488 50%, #14b8a6 100%)', padding: '80px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: SORA, fontSize: 'clamp(26px, 5vw, 42px)', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.5px' }}>
            {k.contato.titulo}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 16.5, lineHeight: 1.7, marginBottom: 32 }}>
            {k.contato.paragrafo}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            <CtaButton {...k.contato.whatsapp} variant="light" icon={<MessageCircle size={18} />} />
            <CtaButton {...k.contato.instagram} variant="outline" icon={<Instagram size={18} />} />
            <CtaButton {...k.contato.site} variant="outline" />
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
