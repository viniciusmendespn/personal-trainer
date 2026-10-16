import { ArrowUpRight } from 'lucide-react'
const steps = [
  [
    'Traga seus alunos',
    'Cadastre manualmente ou importe sua carteira. Comece com até 3 alunos no plano grátis.',
  ],
  [
    'Organize seus treinos',
    'Crie sua biblioteca, reutilize templates e conte com a IA para preparar seus planejamentos.',
  ],
  [
    'Compartilhe o app',
    'Envie o acesso para o aluno consultar o treino e registrar as atividades pelo celular.',
  ],
  [
    'Acompanhe de perto',
    'Veja frequência, avaliações e evolução para orientar os próximos passos de cada aluno.',
  ],
]
export default function HowItWorksSection() {
  return (
    <section id="how" className="cp-section">
      <div className="cp-container">
        <div className="cp-section-head">
          <div>
            <p className="cp-eyebrow">Simples desde o começo</p>
            <h2 className="cp-heading">
              Da sua primeira conta
              <br />
              ao próximo treino.
            </h2>
          </div>
          <p className="cp-subtitle" style={{ maxWidth: 320, fontSize: 14 }}>
            Comece no seu ritmo. A plataforma acompanha o crescimento do seu
            trabalho.
          </p>
        </div>
        <div className="cp-steps">
          {steps.map(([title, text], i) => (
            <div className="cp-step" key={title}>
              <div className="cp-step-number">
                0{i + 1}
                <ArrowUpRight size={18} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
