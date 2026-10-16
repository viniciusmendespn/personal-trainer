import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
const shared = [
  'Treinos e templates',
  'Avaliações físicas e agenda',
  'App do aluno e chat interno',
  'Cadastro por IA e conexão com sua IA',
  'Dashboard e perfil público',
]
export default function PricingSection() {
  return (
    <section id="pricing" className="cp-section cp-soft">
      <div className="cp-container">
        <p className="cp-eyebrow">Espaço para o seu próximo passo</p>
        <div className="cp-section-head">
          <h2 className="cp-heading">
            Comece grátis.
            <br />
            Cresça sem limitar seus alunos.
          </h2>
          <p className="cp-subtitle" style={{ maxWidth: 330, fontSize: 14 }}>
            Planos claros e sem fidelidade. Você escolhe o que faz sentido para
            o seu momento.
          </p>
        </div>
        <div className="cp-pricing-grid">
          <div className="cp-price-card">
            <div className="cp-price-top">Essencial</div>
            <div className="cp-price">
              R$ 0<small> / mês</small>
            </div>
            <p className="cp-price-note">
              Para conhecer a plataforma e organizar seus primeiros alunos. Sem
              cartão.
            </p>
            <ul className="cp-check-list">
              {['Até 3 alunos cadastrados', ...shared].map((item) => (
                <li key={item}>
                  <Check />
                  {item}
                </li>
              ))}
            </ul>
            <Link className="cp-button cp-button-light" to="/signup">
              Criar minha conta grátis <ArrowRight size={16} />
            </Link>
          </div>
          <div className="cp-price-card cp-price-pro">
            <div className="cp-price-top">
              Gestão Pro <span>Preço de lançamento</span>
            </div>
            <div className="cp-price">
              R$ 39,90<small> / mês</small>
            </div>
            <p className="cp-price-note">
              De R$69,90/mês. Ou R$399/ano para acompanhar o crescimento da sua
              carteira.
            </p>
            <ul className="cp-check-list">
              {[
                'Alunos ilimitados',
                ...shared,
                'Relatórios e suporte',
                'Bônus: acesso ao FinPilot a cada mês pago',
              ].map((item) => (
                <li key={item}>
                  <Check />
                  {item}
                </li>
              ))}
            </ul>
            <Link className="cp-button" to="/signup">
              Começar com Gestão Pro <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="cp-addon-row">
          <div>
            <h3>Personalize sua experiência</h3>
            <p>
              A conexão com a IA do personal já está incluída. Os serviços
              abaixo são opcionais.
            </p>
          </div>
          <div>
            <h3>Canal WhatsApp · +R$29,90/mês</h3>
            <p>
              Conecte um número para conversar com seus alunos pelo WhatsApp.
            </p>
          </div>
          <div>
            <h3>IA do aluno · +R$4,90/aluno/mês</h3>
            <p>
              Ative o assistente para os alunos que você escolher, pelo chat
              interno ou WhatsApp com o canal ativo.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
