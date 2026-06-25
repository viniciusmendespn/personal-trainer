import { Check, X } from 'lucide-react'

const ROWS: { feature: string; cp: boolean | string; manual: boolean | string }[] = [
  { feature: 'Plano grátis para começar', cp: true, manual: false },
  { feature: 'Histórico de alunos centralizado', cp: true, manual: false },
  { feature: 'App do aluno incluso', cp: true, manual: false },
  { feature: 'Avaliações físicas com gráficos automáticos', cp: true, manual: false },
  { feature: 'Agenda com lembretes automáticos', cp: true, manual: false },
  { feature: 'Templates de treino reutilizáveis', cp: true, manual: false },
  { feature: 'Ranking e gamificação para engajamento', cp: true, manual: false },
  { feature: 'Dashboard com visão geral do negócio', cp: true, manual: false },
  { feature: 'IA opcional por aluno', cp: true, manual: false },
  { feature: 'WhatsApp opcional integrado', cp: true, manual: 'Manual' },
]

export default function ComparisonSection() {
  return (
    <section id="compare" style={{ background: '#f0fdfa', padding: '80px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(20,184,166,0.12)',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 16,
          }}>
            <span style={{ color: '#0d9488', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Diferenciais</span>
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 12 }}>
            Por que usar CoachPilot?
          </h2>
          <p style={{ color: '#475569', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
            Compare o que você ganha usando nossa plataforma versus planilhas e WhatsApp manual.
          </p>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: '1px solid rgba(20,184,166,0.15)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px' }}>
            <div style={{ padding: '16px 24px', background: '#f8fefd', borderBottom: '2px solid rgba(20,184,166,0.15)' }}>
              <span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>Funcionalidade</span>
            </div>
            <div style={{
              padding: '16px 24px',
              background: 'linear-gradient(135deg, #14b8a6, #10b981)',
              borderBottom: '2px solid rgba(20,184,166,0.15)',
              textAlign: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>CoachPilot</span>
            </div>
            <div style={{ padding: '16px 24px', background: '#f8fefd', borderBottom: '2px solid rgba(20,184,166,0.15)', textAlign: 'center' }}>
              <span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>Concorrentes</span>
            </div>
          </div>

          {ROWS.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 200px 200px',
                background: i % 2 === 0 ? '#fff' : '#f8fefd',
                borderBottom: i < ROWS.length - 1 ? '1px solid rgba(20,184,166,0.08)' : 'none',
              }}
            >
              <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#1e293b', fontSize: 14 }}>{r.feature}</span>
              </div>
              <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {r.cp === true ? (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={16} color="#14b8a6" strokeWidth={2.5} />
                  </div>
                ) : r.cp === false ? (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} color="#ef4444" strokeWidth={2.5} />
                  </div>
                ) : (
                  <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>{r.cp}</span>
                )}
              </div>
              <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {r.manual === true ? (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={16} color="#14b8a6" strokeWidth={2.5} />
                  </div>
                ) : r.manual === false ? (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} color="#ef4444" strokeWidth={2.5} />
                  </div>
                ) : (
                  <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>{r.manual}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
