import { Link } from 'react-router-dom'
import { Instagram } from 'lucide-react'
import './public-site.css'
export default function LandingFooter() {
  return (
    <footer className="cp-footer">
      <div className="cp-container">
        <div className="cp-footer-grid">
          <div>
            <Link to="/">
              <img
                className="cp-logo"
                src="/novo-logo-slogan-semfundo.png"
                alt="CoachPilot"
                width="220"
                height="77"
              />
            </Link>
            <p>
              Tecnologia para organizar sua rotina e aproximar você de cada
              aluno.
            </p>
            <a
              href="https://instagram.com/coachpilotoficial"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Instagram size={15} /> @coachpilotoficial
            </a>
          </div>
          <div>
            <h3>Plataforma</h3>
            <nav aria-label="Plataforma">
              <a href="/#features">Funcionalidades</a>
              <a href="/#chatgpt">Inteligência artificial</a>
              <a href="/#how">Como funciona</a>
              <a href="/#pricing">Planos e preços</a>
              <a href="https://loja.coachpilot.com.br">Loja de pacotes</a>
            </nav>
          </div>
          <div>
            <h3>Explore</h3>
            <nav aria-label="Recursos">
              <Link to="/blog">Blog CoachPilot</Link>
              <Link to="/calculadoras">Calculadoras</Link>
              <Link to="/integracoes/chatgpt">Integração com ChatGPT</Link>
              <Link to="/gestao-de-alunos-personal-trainer">
                Gestão de alunos
              </Link>
              <Link to="/faq">Perguntas frequentes</Link>
            </nav>
          </div>
          <div>
            <h3>Vamos crescer juntos</h3>
            <nav aria-label="CoachPilot">
              <Link to="/divulgadores">Seja um divulgador</Link>
              <Link to="/midia-kit">Mídia kit</Link>
              <Link to="/sobre">Sobre o CoachPilot</Link>
              <Link to="/signup">Crie sua conta grátis</Link>
              <Link to="/login">Acesse sua conta</Link>
            </nav>
          </div>
        </div>
        <div className="cp-footer-bottom">
          <span>
            © {new Date().getFullYear()} CoachPilot. Todos os direitos
            reservados.
          </span>
          <nav aria-label="Informações legais">
            <Link to="/termos">Termos de uso</Link>
            <Link to="/privacidade">Privacidade</Link>
          </nav>
          <span>Feito para quem treina pessoas.</span>
        </div>
      </div>
    </footer>
  )
}
