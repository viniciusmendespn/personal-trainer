import { ArrowRight, Layers, Download, Store } from 'lucide-react'
export default function LojaSection() {
  return (
    <section id="loja" className="cp-section cp-soft">
      <div className="cp-container cp-split">
        <img
          className="cp-market-photo"
          src="/images/coachpilot-training-v2.webp"
          alt="Aluna executando um exercício de força com acompanhamento profissional"
          width="1536"
          height="1024"
          loading="lazy"
        />
        <div className="cp-market-copy">
          <p className="cp-eyebrow">Loja CoachPilot</p>
          <h2 className="cp-heading">
            Conhecimento de quem
            <br />
            treina pessoas.
            <br />
            Pronto para ir além.
          </h2>
          <p className="cp-subtitle">
            Explore métodos criados por outros profissionais ou transforme sua
            experiência em pacotes para vender.
          </p>
          <div className="cp-market-detail">
            <Layers />
            <div>
              <strong>Métodos completos, em um só pacote</strong>
              <p>Rotinas, templates de treino e exercícios organizados.</p>
            </div>
          </div>
          <div className="cp-market-detail">
            <Download />
            <div>
              <strong>Da loja para sua conta</strong>
              <p>Instale o pacote e adapte o planejamento aos seus alunos.</p>
            </div>
          </div>
          <div className="cp-actions">
            <a className="cp-button" href="https://loja.coachpilot.com.br">
              Explorar a loja <ArrowRight size={16} />
            </a>
            <a className="cp-text-link" href="/loja-vendas">
              <Store size={15} /> Quero vender meus métodos
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
