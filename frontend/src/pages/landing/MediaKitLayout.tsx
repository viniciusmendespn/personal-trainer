import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown, ArrowUpRight, Building2, Check, Dumbbell, GraduationCap,
  Instagram, Layers3, MessageCircle, Monitor, Play, Share2, Smartphone, Users,
} from 'lucide-react'
import LandingNavbar from './LandingNavbar'
import LandingFooter from './LandingFooter'
import { MEDIA_KIT } from './mediaKitData.js'
import type { MediaKitLink } from './mediaKitData.js'
import './public-site.css'
import './media-kit.css'

type Track = (event: string, params?: Record<string, unknown>) => void

function KitLink({ href, label, event, className = 'cp-button', icon, track }: Omit<MediaKitLink, 'label'> & {
  label: ReactNode; className?: string; icon?: ReactNode; track: Track
}) {
  const onClick = () => {
    if (event) track(event, { partner_source: new URLSearchParams(window.location.search).get('utm_source') ?? '(direto)' })
  }
  const content = <>{label}{icon ?? <ArrowUpRight size={17} aria-hidden="true" />}</>
  return href.startsWith('/')
    ? <Link to={href} className={className} onClick={onClick}>{content}</Link>
    : <a href={href} className={className} onClick={onClick} target="_blank" rel="noopener noreferrer">{content}</a>
}

function SectionIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="mk-section-intro">
    <p className="cp-eyebrow">{eyebrow}</p>
    <h2 className="cp-heading">{title}</h2>
    {children && <p className="cp-subtitle">{children}</p>}
  </div>
}

function Checklist({ items }: { items: string[] }) {
  return <ul className="mk-checklist">{items.map((item) => <li key={item}>
    <Check size={16} aria-hidden="true" /><span>{item}</span>
  </li>)}</ul>
}

const shotLabels = ['Prescrição de treino', 'Portal do personal', 'Evolução', 'Ranking', 'App do aluno']
const featureIcons = [Users, Dumbbell, Smartphone]
const formatIcons = [Share2, Play, Building2, GraduationCap]

function ProductGallery() {
  const [active, setActive] = useState(0)
  const [failed, setFailed] = useState<string[]>([])
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const shots = MEDIA_KIT.provaVisual.imagens
  const shot = shots[active]
  const changeTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % shots.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + shots.length) % shots.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = shots.length - 1
    else return
    event.preventDefault()
    setActive(next)
    tabs.current[next]?.focus()
  }
  return <div className="mk-gallery">
    <div className="mk-gallery-tabs" role="tablist" aria-label="Telas da plataforma">
      {shots.map((item, index) => <button
        key={item.src} ref={(element) => { tabs.current[index] = element }} type="button"
        id={`mk-tab-${index}`} role="tab" aria-selected={active === index}
        aria-controls="mk-product-panel" tabIndex={active === index ? 0 : -1}
        onClick={() => setActive(index)} onKeyDown={(event) => changeTab(event, index)}
      >{shotLabels[index]}</button>)}
    </div>
    <div id="mk-product-panel" role="tabpanel" aria-labelledby={`mk-tab-${active}`} tabIndex={0}>
      <div className="mk-browser-bar" aria-hidden="true"><span><i /><i /><i /></span><span>CoachPilot · {shotLabels[active]}</span><Monitor size={14} /></div>
      <figure>
        <div className={`mk-screen${shot.retrato ? ' mk-screen-portrait' : ''}`}>
          {failed.includes(shot.src)
            ? <p className="mk-image-fallback">Esta prévia está indisponível. Peça uma demonstração pelo WhatsApp.</p>
            : <a href={shot.src} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar: ${shotLabels[active]}`}>
              <img key={shot.src} src={shot.src} alt={shot.alt} loading="lazy" decoding="async"
                onError={() => setFailed((current) => [...current, shot.src])} />
            </a>}
        </div>
        <figcaption><span>{shot.legenda}</span><span className="mk-real-label"><i /> Tela real do produto</span></figcaption>
      </figure>
    </div>
  </div>
}

export default function MediaKitLayout({ track }: { track: Track }) {
  const k = MEDIA_KIT
  return <div className="cp-public mk-page">
    <a className="cp-skip" href="#conteudo">Ir para o conteúdo</a>
    <LandingNavbar />
    <main id="conteudo">
      <section className="mk-hero cp-dark">
        <div className="cp-container">
          <div className="mk-hero-topline"><span>COACHPILOT / MÍDIA KIT</span><span>Fitness. Tecnologia. Conexões.</span></div>
          <div className="mk-hero-grid">
            <div className="mk-hero-copy">
              <p className="cp-eyebrow">{k.hero.eyebrow}</p>
              <h1>Boas conexões.<br />Novas <em>possibilidades.</em></h1>
              <p className="mk-hero-description">{k.hero.subheadline}</p>
              <div className="cp-actions">
                <KitLink {...k.hero.ctaSecundario} track={track} />
                <a className="mk-hero-explore" href="#plataforma">Explore o mídia kit <ArrowDown size={16} aria-hidden="true" /></a>
              </div>
            </div>
            <div className="mk-hero-art">
              <img className="mk-hero-image" src="/images/coachpilot-editorial-v2.webp" alt="Tecnologia e planejamento na rotina de uma academia, com notebook e equipamentos de treino" width="1536" height="1024" fetchPriority="high" />
            </div>
          </div>
          <nav className="mk-section-nav" aria-label="Explore o mídia kit">
            {[['01', 'A plataforma', '#plataforma'], ['02', 'Nosso público', '#publico'], ['03', 'Parcerias', '#parcerias'], ['04', 'Vamos conversar', '#contato']].map(([n, label, href]) => <a key={href} href={href}><span>{n}</span>{label}<ArrowDown size={14} aria-hidden="true" /></a>)}
          </nav>
        </div>
      </section>

      <section className="mk-metrics" aria-label="CoachPilot em números">
        <div className="cp-container">
          <div className="mk-metrics-grid">{k.metricas.map((metric) => <div key={metric.label}><strong>{metric.valor}</strong><span>{metric.label}</span></div>)}</div>
          <p>{k.metricasNota}</p>
        </div>
      </section>

      <section id="plataforma" className="cp-section">
        <div className="cp-container">
          <div className="mk-split-intro">
            <SectionIntro eyebrow="Muito além de um app" title={k.resumo.titulo} />
            <p className="cp-subtitle">{k.resumo.paragrafo}</p>
          </div>
          <div className="mk-features-grid">{k.resumo.cards.map((card, index) => {
            const Icon = featureIcons[index]
            return <article className="mk-feature" key={card.titulo}><Icon size={23} strokeWidth={1.5} aria-hidden="true" /><h3>{card.titulo}</h3><p>{card.desc}</p></article>
          })}</div>
          <div className="mk-product-heading"><div><p className="cp-eyebrow">Veja na prática</p><h3>{k.provaVisual.titulo}</h3><p>{k.provaVisual.intro}</p></div><KitLink {...k.hero.ctaPrimario} className="cp-text-link" track={track} /></div>
          <ProductGallery />
        </div>
      </section>

      <section id="publico" className="cp-section cp-soft">
        <div className="cp-container mk-audience-grid">
          <div className="mk-audience-photo"><img src="/images/coachpilot-coaching-v2.webp" alt="Personal trainer orientando uma aluna durante o planejamento de treino" width="1536" height="1024" loading="lazy" /></div>
          <div><SectionIntro eyebrow="Uma audiência com propósito" title={k.publico.titulo}>{k.publico.intro}</SectionIntro>
            <div className="mk-audience-tags">{k.publico.itens.map((item) => <span key={item}>{item}</span>)}</div>
          </div>
        </div>
      </section>

      <section className="cp-section cp-dark mk-ai-section">
        <div className="cp-container">
          <div className="mk-ai-grid"><div>
            <SectionIntro eyebrow={k.conexaoIa.eyebrow} title={k.conexaoIa.titulo}>{k.conexaoIa.intro}</SectionIntro>
            <a href="/integracoes/chatgpt" className="mk-light-link">Detalhes da integração <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div><div className="mk-connection" aria-label="CoachPilot conecta os dados do personal a assistentes de inteligência artificial via MCP">
            <div className="mk-connection-source"><Layers3 size={26} aria-hidden="true" /><strong>CoachPilot</strong><span>Alunos · Treinos · Evolução</span></div>
            <div className="mk-connection-line"><span>MCP · CONEXÃO ABERTA</span></div>
            <div className="mk-assistants"><span>ChatGPT<small>App no diretório</small></span><span>Claude<small>Conector MCP</small></span><span>Gemini<small>CLI / Vertex AI</small></span></div>
          </div></div>
        </div>
      </section>

      <section id="parcerias" className="cp-section cp-soft">
        <div className="cp-container">
          <SectionIntro eyebrow="Parcerias" title={k.parceria.titulo}>{k.parceria.paragrafo}</SectionIntro>
          <div className="mk-formats">{k.formatos.map((format, index) => {
            const Icon = formatIcons[index]
            return <article key={format.titulo} className={`mk-format${format.destaque ? ' mk-format-featured cp-dark' : ''}`}>
              <div className="mk-format-top"><Icon size={24} strokeWidth={1.5} aria-hidden="true" /><span>{format.destaque ? 'FORMATO PRINCIPAL' : `0${index + 1}`}</span></div>
              <h3>{format.titulo}</h3><p>{format.desc}</p>{format.itens.length > 0 && <Checklist items={format.itens} />}
              {format.cta && <KitLink {...format.cta} track={track} />}
            </article>
          })}</div>
          <p className="mk-note">{k.formatosNota}</p>
        </div>
      </section>

      <section className="cp-section"><div className="cp-container mk-faq-grid">
        <SectionIntro eyebrow="Dúvidas práticas" title="Antes de começar" />
        <div className="cp-faq-list">{k.faqs.map((faq) => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}</div>
      </div></section>

      <section id="contato" className="cp-dark mk-contact"><div className="cp-container mk-contact-grid">
        <div><h2>Vamos criar<br /><em>algo juntos?</em></h2><p>{k.contato.paragrafo}</p><div className="cp-actions"><KitLink {...k.contato.whatsapp} track={track} icon={<MessageCircle size={18} aria-hidden="true" />} /><KitLink {...k.contato.instagram} className="mk-light-link" track={track} icon={<Instagram size={18} aria-hidden="true" />} /></div></div>
        <div className="mk-contact-brand"><img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot — Gestão completa para personal trainers" width="1703" height="631" loading="lazy" /></div>
      </div></section>
    </main>
    <LandingFooter />
  </div>
}
