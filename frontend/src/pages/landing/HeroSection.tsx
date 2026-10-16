import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Users,
  Smartphone,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
export default function HeroSection() {
  return (
    <section className="cp-hero">
      <div className="cp-container">
        <div className="cp-hero-grid">
          <div className="cp-hero-copy">
            <a className="cp-new" href="#chatgpt">
              <span>INTELIGÊNCIA ARTIFICIAL</span> Seu CoachPilot, agora no
              ChatGPT <ArrowRight size={12} />
            </a>
            <h1>
              Mais tempo para
              <br />
              treinar pessoas.
              <br />
              <em>
                Mais controle
                <br />
                para crescer.
              </em>
            </h1>
            <p>
              Alunos, treinos, avaliações e agenda em um só lugar. Organize sua
              rotina, acompanhe cada evolução e cuide do que faz seu trabalho
              ser único.
            </p>
            <div className="cp-actions">
              <Link className="cp-button" to="/signup">
                Começar grátis <ArrowRight size={17} />
              </Link>
              <a className="cp-button cp-button-outline" href="#features">
                Conhecer a plataforma
              </a>
            </div>
            <div className="cp-hero-note">
              <span>
                <Check size={13} /> Grátis para até 3 alunos
              </span>
              <span>
                <Check size={13} /> Sem cartão de crédito
              </span>
            </div>
          </div>
          <div className="cp-hero-visual">
            <img
              className="cp-hero-photo"
              src="/images/coachpilot-coaching-v2.webp"
              alt="Personal trainer e aluna revisando o planejamento do treino em uma academia"
              width="1536"
              height="1024"
              fetchPriority="high"
            />
            <div className="cp-photo-label">
              <i /> Tecnologia a favor de quem treina pessoas
            </div>
            <div
              className="cp-preview"
              aria-label="Exemplo ilustrativo de acompanhamento do aluno"
            >
              <div className="cp-preview-head">
                <span>EVOLUÇÃO DO ALUNO</span>
                <TrendingUp size={15} color="#168c70" />
              </div>
              <span className="cp-preview-title">Cada treino conta.</span>
              <small>Acompanhe a evolução ao longo do tempo.</small>
              <div className="cp-preview-bars" aria-hidden="true">
                {[30, 42, 37, 58, 66, 77, 92].map((height, i) => (
                  <span key={i} style={{ height: height + '%' }} />
                ))}
              </div>
              <small style={{ display: 'block', marginTop: 9 }}>
                Visualização ilustrativa
              </small>
            </div>
          </div>
        </div>
        <div className="cp-hero-bottom">
          <span>Uma plataforma. Sua rotina inteira.</span>
          <span>
            <Users />
            <strong>Alunos ilimitados no Pro</strong>
          </span>
          <span>
            <Smartphone />
            <strong>App para seus alunos</strong>
          </span>
          <span>
            <Sparkles />
            <strong>Conexão com a sua IA</strong>
          </span>
        </div>
      </div>
    </section>
  )
}
