import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown, ArrowRight, ArrowUpRight, Building2, CalendarDays, Check,
  ChevronDown, Dumbbell, GraduationCap, Instagram, Layers3, MessageCircle,
  Monitor, Play, Plug, Share2, Smartphone, Sparkles, Users,
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
const featureIcons = [Users, Dumbbell, Smartphone, Sparkles, Plug, CalendarDays]
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
              <p className="mk-hero-lead">Tecnologia e inteligência artificial para quem transforma vidas pelo treino.</p>
              <p className="mk-hero-description">Somos o CoachPilot: a plataforma brasileira de gestão para personal trainers. Conectamos fitness, tecnologia e marcas que querem crescer com esse mercado.</p>
              <div className="cp-actions">
                <KitLink {...k.hero.ctaSecundario} track={track} />
                <a className="mk-hero-explore" href="#plataforma">Explore o mídia kit <ArrowDown size={16} aria-hidden="true" /></a>
              </div>
              <div className="mk-hero-tags"><span>Para marcas</span><span>Para creators</span><span>Para educadores</span></div>
            </div>
            <div className="mk-hero-art">
              <img className="mk-hero-image" src="/images/coachpilot-editorial-v2.webp" alt="Tecnologia e planejamento na rotina de uma academia, com notebook e equipamentos de treino" width="1536" height="1024" fetchPriority="high" />
              <div className="mk-image-caption"><span className="mk-live-dot" /> O próximo passo do personal começa aqui.</div>
              <div className="mk-art-card"><span className="mk-art-icon"><Sparkles size={21} aria-hidden="true" /></span><div><small>GESTÃO + INTELIGÊNCIA ARTIFICIAL</small><strong>Mais potencial.<br />Mais perto das pessoas.</strong></div><ArrowUpRight size={25} aria-hidden="true" /></div>
              <span className="mk-art-index" aria-hidden="true">CP / CONEXÕES QUE MOVEM</span>
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
          <div className="mk-audience-photo"><img src="/images/coachpilot-coaching-v2.webp" alt="Personal trainer orientando uma aluna durante o planejamento de treino" width="1536" height="1024" loading="lazy" /><div><span>A NOSSA CONEXÃO É COM GENTE.</span><strong>Quem treina pessoas.<br />Quem move o mercado.</strong></div></div>
          <div><SectionIntro eyebrow="Uma audiência com propósito" title={k.publico.titulo}>{k.publico.intro}</SectionIntro>
            <div className="mk-audience-tags">{k.publico.itens.map((item) => <span key={item}>{item}</span>)}</div>
            <p className="mk-audience-note"><Users size={22} aria-hidden="true" /><span>{k.publico.nota}</span></p>
          </div>
        </div>
      </section>

      <section className="cp-section cp-dark mk-ai-section">
        <div className="cp-container">
          <div className="mk-ai-grid"><div>
            <SectionIntro eyebrow="Inteligência que conecta" title="A IA que o personal já usa. Os dados que fazem a diferença.">Alunos, avaliações e treinos conectados ao assistente do profissional. Mais contexto para a IA, mais autonomia para quem prescreve.</SectionIntro>
            <a href="/integracoes/chatgpt" className="mk-light-link">Conheça a conexão com IA <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div><div className="mk-connection" aria-label="CoachPilot conecta os dados do personal a assistentes de inteligência artificial via MCP">
            <div className="mk-connection-source"><Layers3 size={26} aria-hidden="true" /><strong>CoachPilot</strong><span>Alunos · Treinos · Evolução</span></div>
            <div className="mk-connection-line"><span>MCP · CONEXÃO ABERTA</span></div>
            <div className="mk-assistants"><span>ChatGPT<small>App no diretório</small></span><span>Claude<small>Conector MCP</small></span><span>Gemini<small>CLI / Vertex AI</small></span></div>
          </div></div>
          <details className="mk-ai-details"><summary>Como funciona a conexão com IA <ChevronDown size={18} aria-hidden="true" /></summary><div>
            <h3>{k.conexaoIa.titulo}</h3><p>{k.conexaoIa.intro}</p><span className="mk-endpoint"><Plug size={14} aria-hidden="true" />{k.conexaoIa.endpoint}</span>
            <div className="mk-ai-details-grid">{k.conexaoIa.grupos.map((group) => <article key={group.titulo}><h4>{group.titulo}</h4><p>{group.desc}</p><Checklist items={group.itens} /></article>)}</div>
            <p className="mk-note">{k.conexaoIa.nota}</p>
          </div></details>
        </div>
      </section>

      <section className="cp-section">
        <div className="cp-container"><SectionIntro eyebrow="O que nos move" title="Um produto pensado para a rotina real." />
          <div className="mk-differences">{k.diferenciais.map((item, index) => <article key={item.titulo}><span>0{index + 1}</span><div><h3>{item.titulo}</h3><p>{item.desc}</p></div></article>)}</div>
        </div>
      </section>

      <section id="parcerias" className="cp-section cp-soft">
        <div className="cp-container">
          <div className="mk-split-intro"><SectionIntro eyebrow="Crescer é um trabalho em conjunto" title={k.parceria.titulo} /><p className="cp-subtitle">{k.parceria.paragrafo}</p></div>
          <div className="mk-partner-benefits"><Checklist items={k.parceria.beneficios} /></div>
          <div className="mk-formats-heading"><p className="cp-eyebrow">Encontre a sua conexão</p><h3>Uma parceria. Diferentes possibilidades.</h3><p>Do primeiro conteúdo a uma relação de longo prazo, construímos o formato que faz sentido para a sua audiência.</p></div>
          <div className="mk-formats">{k.formatos.map((format, index) => {
            const Icon = formatIcons[index]
            return <article key={format.titulo} className={`mk-format${format.destaque ? ' mk-format-featured cp-dark' : ''}`}>
              <div className="mk-format-top"><Icon size={24} strokeWidth={1.5} aria-hidden="true" /><span>{format.destaque ? 'FORMATO PRINCIPAL' : `0${index + 1}`}</span></div>
              <h3>{format.titulo}</h3><p>{format.desc}</p><Checklist items={format.itens} />
              {format.cta && <KitLink {...format.cta} track={track} />}
            </article>
          })}</div>
          <p className="mk-note">{k.formatosNota}</p>
        </div>
      </section>

      <section className="cp-section mk-synergy"><div className="cp-container">
        <SectionIntro eyebrow="Valor para todos os lados" title={k.sinergia.titulo}>{k.sinergia.paragrafo}</SectionIntro>
        <div className="mk-synergy-grid">{k.sinergia.colunas.map((column, index) => <article key={column.titulo}><span className="mk-synergy-number">0{index + 1}</span><h3>{column.titulo}</h3><p>{column.desc}</p><ArrowRight size={22} aria-hidden="true" /></article>)}</div>
      </div></section>

      <section className="cp-section cp-soft"><div className="cp-container mk-faq-grid">
        <div><SectionIntro eyebrow="Antes da primeira conversa" title="Talvez você esteja se perguntando…" /><p className="cp-subtitle">Da afinidade de público ao formato da parceria, vamos esclarecer cada detalhe.</p><KitLink {...k.contato.whatsapp} className="cp-text-link mk-faq-contact" track={track} icon={<MessageCircle size={17} aria-hidden="true" />} /></div>
        <div className="cp-faq-list">{k.faqs.map((faq) => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}</div>
      </div></section>

      <section className="cp-section mk-channels"><div className="cp-container">
        <div className="mk-split-intro"><SectionIntro eyebrow="Canais oficiais" title="Conheça. Explore. Conecte-se." /><p className="cp-subtitle">Todos os caminhos para conhecer o ecossistema CoachPilot e acompanhar o que estamos construindo.</p></div>
        <div className="mk-channels-grid">{k.links.map((link) => <KitLink key={link.label} {...link} label={<span>{link.label}<strong>{link.valor}</strong></span>} className="mk-channel" track={track} />)}</div>
      </div></section>

      <section id="contato" className="cp-dark mk-contact"><div className="cp-container mk-contact-grid">
        <div><p className="cp-eyebrow">A próxima conexão pode ser a nossa</p><h2>Vamos criar<br /><em>algo juntos?</em></h2><p>{k.contato.paragrafo}</p><div className="cp-actions"><KitLink {...k.contato.whatsapp} track={track} icon={<MessageCircle size={18} aria-hidden="true" />} /><KitLink {...k.contato.instagram} className="mk-light-link" track={track} icon={<Instagram size={18} aria-hidden="true" />} /></div></div>
        <div className="mk-contact-symbol" aria-hidden="true"><span>c<span>p</span><i>↗</i></span><small>CONEXÕES QUE MOVEM O FITNESS.</small></div>
      </div></section>
    </main>
    <LandingFooter />
  </div>
}
