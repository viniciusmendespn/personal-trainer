import { Users, Dumbbell, Activity, Calendar, Smartphone, Trophy, MessageCircle, BarChart2, Bell } from 'lucide-react'
import { useState } from 'react'

const FEATURES = [
  {
    icon: <Users size={28} />,
    title: 'Gestão de Alunos',
    desc: 'Cadastro, histórico e evolução de cada aluno em um só lugar. Acesse tudo em segundos, sem planilhas espalhadas.',
    color: '#14b8a6',
  },
  {
    icon: <Dumbbell size={28} />,
    title: 'Treinos Personalizados',
    desc: 'Monte templates de treino reutilizáveis e aplique em vários alunos com um clique. Economize horas de trabalho repetitivo.',
    color: '#10b981',
  },
  {
    icon: <Activity size={28} />,
    title: 'Avaliações Físicas',
    desc: 'Registre medidas e fotos e acompanhe a evolução do aluno com gráficos automáticos, gerados a cada nova avaliação.',
    color: '#14b8a6',
  },
  {
    icon: <Calendar size={28} />,
    title: 'Agenda Inteligente',
    desc: 'Organize sessões e horários com lembretes automáticos por WhatsApp, para você e para o aluno nunca esquecerem um treino.',
    color: '#10b981',
  },
  {
    icon: <Smartphone size={28} />,
    title: 'App do Aluno (PWA)',
    desc: 'Seu aluno acompanha o treino do dia, registra a evolução e recebe notificações direto no celular — sem instalar nada da loja de apps.',
    color: '#14b8a6',
  },
  {
    icon: <Trophy size={28} />,
    title: 'Ranking e Gamificação',
    desc: 'Engaje seus alunos com ranking de frequência e desempenho. Quem treina mais, sobe no ranking — e continua motivado.',
    color: '#10b981',
  },
  {
    icon: <MessageCircle size={28} />,
    title: 'Canal WhatsApp (opcional)',
    desc: 'Add-on opcional por +R$29,90/mês. Conecte um número de WhatsApp para facilitar a comunicação com seus alunos e, se quiser, ativar o assistente IA via WA.',
    color: '#14b8a6',
  },
  {
    icon: <BarChart2 size={28} />,
    title: 'Relatórios e Métricas',
    desc: 'Visualize evolução de força, cardio e composição corporal com gráficos detalhados. Mostre resultados concretos para seus alunos.',
    color: '#10b981',
  },
  {
    icon: <Bell size={28} />,
    title: 'Notificações Automáticas',
    desc: 'Lembretes de treino, avaliação e renovação enviados automaticamente pelo WhatsApp — sem você precisar fazer nada manualmente.',
    color: '#14b8a6',
  },
]

export default function FeaturesSection() {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <section id="features" style={{ background: '#f0fdfa', padding: '80px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(20,184,166,0.12)',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 16,
          }}>
            <span style={{ color: '#0d9488', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Funcionalidades</span>
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 14 }}>
            Tudo que você precisa para profissionalizar{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              sua gestão
            </span>
          </h2>
          <p style={{ color: '#475569', fontSize: 17, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
            Uma plataforma completa para personal trainers que querem dar um upgrade na forma como cuidam dos alunos.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}
          className="features-grid">
          <style>{`
            @media (max-width: 900px) { .features-grid { grid-template-columns: repeat(2, 1fr) !important; } }
            @media (max-width: 580px) { .features-grid { grid-template-columns: 1fr !important; } }
          `}</style>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: '#fff',
                border: `1.5px solid ${hovered === i ? f.color : 'rgba(20,184,166,0.12)'}`,
                borderRadius: 16,
                padding: 28,
                cursor: 'default',
                transform: hovered === i ? 'translateY(-6px)' : 'none',
                boxShadow: hovered === i ? `0 12px 32px rgba(20,184,166,0.15)` : '0 2px 8px rgba(0,0,0,0.06)',
                transition: 'all 0.25s ease',
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: `rgba(20,184,166,0.1)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 18, color: f.color,
                transition: 'background 0.25s',
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
