import { UserPlus, ClipboardList, LineChart, Smartphone } from 'lucide-react'

const STEPS = [
  {
    icon: <UserPlus size={28} />,
    title: 'Cadastre seus alunos',
    desc: 'Importe ou cadastre manualmente, em minutos. Cada aluno fica com seu histórico, contato e plano organizados.',
  },
  {
    icon: <ClipboardList size={28} />,
    title: 'Monte os treinos',
    desc: 'Use templates reutilizáveis ou crie do zero, e vincule cada treino à agenda do aluno.',
  },
  {
    icon: <LineChart size={28} />,
    title: 'Acompanhe a evolução',
    desc: 'Registre avaliações físicas e veja gráficos de evolução gerados automaticamente a cada nova medição.',
  },
  {
    icon: <Smartphone size={28} />,
    title: 'Engaje pelo app do aluno',
    desc: 'O aluno acessa o treino do dia, recebe notificações e sobe no ranking de frequência direto pelo celular.',
  },
]

export default function HowItWorksSection() {
  return (
    <section id="how" style={{ background: '#fff', padding: '80px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(20,184,166,0.12)',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 16,
          }}>
            <span style={{ color: '#0d9488', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Como Funciona</span>
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 14 }}>
            Do cadastro ao primeiro treino em{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              4 passos
            </span>
          </h2>
          <p style={{ color: '#475569', fontSize: 17, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            Não precisa de conhecimento técnico. Em poucos minutos você já está gerenciando seus alunos como um profissional.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32, position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: 36,
            left: '12%',
            right: '12%',
            height: 2,
            background: 'linear-gradient(90deg, #14b8a6 0%, #10b981 100%)',
            opacity: 0.2,
            display: 'none',
          }} className="lg:block" />

          {STEPS.map((s, i) => (
            <div key={i} style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: '0 6px 20px rgba(20,184,166,0.3)',
                color: '#fff',
                position: 'relative',
              }}>
                {s.icon}
                <div style={{
                  position: 'absolute', top: -8, right: -8,
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#0f172a',
                  border: '2px solid #14b8a6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#14b8a6', fontSize: 11, fontWeight: 700,
                }}>
                  {i + 1}
                </div>
              </div>

              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.65, maxWidth: 220, margin: '0 auto' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
