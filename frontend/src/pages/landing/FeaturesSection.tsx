import {
  Users,
  Dumbbell,
  Activity,
  CalendarDays,
  Smartphone,
  ChartNoAxesCombined,
  Trophy,
  MessageCircle,
  ArrowRight,
} from 'lucide-react'
const features = [
  {
    icon: Users,
    title: 'Cada aluno, bem acompanhado',
    text: 'Cadastro, anamnese e histórico reunidos. Tenha o contexto que precisa antes de cada atendimento.',
  },
  {
    icon: Dumbbell,
    title: 'Treinos com a sua assinatura',
    text: 'Crie treinos personalizados, reutilize templates e organize rotinas de acordo com cada objetivo.',
  },
  {
    icon: Activity,
    title: 'Evolução que dá para ver',
    text: 'Registre medidas, avaliações e fotos. Transforme o progresso dos seus alunos em gráficos claros.',
  },
  {
    icon: CalendarDays,
    title: 'Uma agenda organizada',
    text: 'Reúna sessões e avaliações em uma visão prática para planejar melhor sua semana.',
  },
  {
    icon: Smartphone,
    title: 'Seu trabalho no celular do aluno',
    text: 'Um app para consultar o treino do dia, registrar as séries e acompanhar a própria evolução.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Decisões com mais contexto',
    text: 'Acompanhe frequência, cargas e recordes para ajustar o planejamento com dados do dia a dia.',
  },
]
export default function FeaturesSection() {
  return (
    <section id="features" className="cp-section cp-soft">
      <div className="cp-container">
        <div className="cp-section-head">
          <div>
            <p className="cp-eyebrow">Sua rotina, simplificada</p>
            <h2 className="cp-heading">
              Você cuida dos alunos.
              <br />O CoachPilot conecta o resto.
            </h2>
          </div>
          <p className="cp-subtitle" style={{ maxWidth: 330, fontSize: 14 }}>
            Uma visão completa do seu trabalho, do primeiro cadastro ao próximo
            resultado.
          </p>
        </div>
        <div className="cp-feature-grid">
          {features.map(({ icon: Icon, title, text }) => (
            <div className="cp-feature" key={title}>
              <div className="cp-feature-icon">
                <Icon size={21} strokeWidth={1.6} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <div className="cp-feature-footer">
          <span>
            <Trophy size={16} /> Ranking e gamificação para engajar
          </span>
          <span>
            <MessageCircle size={16} /> Chat interno para conversar
          </span>
          <a className="cp-text-link" href="#pricing">
            Conheça os planos <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  )
}
