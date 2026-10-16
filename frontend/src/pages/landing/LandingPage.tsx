import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import LandingNavbar from './LandingNavbar'
import HeroSection from './HeroSection'
import ChatGptSection from './ChatGptSection'
import FeaturesSection from './FeaturesSection'
import HowItWorksSection from './HowItWorksSection'
import LojaSection from './LojaSection'
import PricingSection from './PricingSection'
import FaqSection from './FaqSection'
import CtaSection from './CtaSection'
import LandingFooter from './LandingFooter'
import './public-site.css'

const highlights = [
  {
    slug: 'como-instalar-coachpilot-no-chatgpt',
    category: 'Inteligência artificial',
    title: 'Seu CoachPilot dentro do ChatGPT.',
    image: 'editorial',
    description:
      'Veja como conectar a sua conta e começar a trabalhar por conversa.',
  },
  {
    slug: 'gestao-de-alunos-guia-completo',
    category: 'Gestão e carreira',
    title: 'Mais organização para cuidar de cada aluno.',
    image: 'coaching',
    description:
      'Um guia para conectar atendimento, planejamento e acompanhamento.',
  },
  {
    slug: 'como-montar-treino-com-ia-chatgpt',
    category: 'Treinos na prática',
    title: 'Da conversa ao planejamento de treino.',
    image: 'training',
    description: 'Entenda como incluir a IA na rotina de prescrição e revisão.',
  },
]

export default function LandingPage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!isLoading && user) navigate('/dashboard', { replace: true })
  }, [user, isLoading, navigate])
  useEffect(() => {
    document.title =
      'CoachPilot — Gestão para Personal Trainers direto no ChatGPT'
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Alunos, treinos, avaliações e agenda em um só lugar. Conheça o CoachPilot, conecte sua IA e comece grátis para até 3 alunos, sem cartão.',
      )
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute('href', 'https://coachpilot.com.br/')
  }, [])
  if (isLoading)
    return (
      <div
        className="cp-public cp-dark"
        style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
        role="status"
      >
        Carregando CoachPilot…
      </div>
    )
  if (user) return null
  return (
    <div className="cp-public">
      <a className="cp-skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <LandingNavbar />
      <main id="conteudo">
        <HeroSection />
        <FeaturesSection />
        <ChatGptSection />
        <HowItWorksSection />
        <LojaSection />
        <PricingSection />
        <section className="cp-section">
          <div className="cp-container">
            <div className="cp-section-head">
              <div>
                <p className="cp-eyebrow">Blog CoachPilot</p>
                <h2 className="cp-heading">
                  Ideias para evoluir
                  <br />
                  sua forma de trabalhar.
                </h2>
              </div>
              <a className="cp-text-link" href="/blog">
                Explore o blog <ArrowRight size={16} />
              </a>
            </div>
            <div className="cp-blog-grid" style={{ paddingBottom: 0 }}>
              {highlights.map((post) => (
                <a
                  className="cp-article-card"
                  key={post.slug}
                  href={'/blog/' + post.slug}
                >
                  <img
                    src={'/images/coachpilot-' + post.image + '-v2.webp'}
                    alt=""
                    width="1536"
                    height="1024"
                    loading="lazy"
                  />
                  <span className="cp-category">{post.category}</span>
                  <h3>{post.title}</h3>
                  <p>{post.description}</p>
                  <span className="cp-text-link">
                    Ler artigo <ArrowRight size={14} />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
        <FaqSection />
        <CtaSection />
      </main>
      <LandingFooter />
      <a
        className="cp-wa"
        href="https://wa.me/5513988088204?text=Ol%C3%A1!+Gostaria+de+saber+mais+sobre+o+CoachPilot"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale com a equipe no WhatsApp"
        title="Fale com a equipe no WhatsApp"
      >
        <MessageCircle size={24} />
      </a>
    </div>
  )
}
