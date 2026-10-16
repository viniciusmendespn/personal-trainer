import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
export default function CtaSection() {
  return (
    <section className="cp-final">
      <div className="cp-container cp-final-inner">
        <div>
          <p className="cp-eyebrow">Seu próximo passo começa aqui</p>
          <h2 className="cp-heading">
            Sua experiência merece
            <br />
            uma gestão à altura.
          </h2>
          <p>
            Crie sua conta, cadastre seus primeiros alunos e conheça um jeito
            mais organizado de trabalhar.
          </p>
        </div>
        <div>
          <Link className="cp-button" to="/signup">
            Começar grátis agora <ArrowRight size={17} />
          </Link>
          <p style={{ fontSize: 11, marginTop: 12 }}>
            Até 3 alunos grátis · Sem cartão · Sem fidelidade
          </p>
        </div>
      </div>
    </section>
  )
}
