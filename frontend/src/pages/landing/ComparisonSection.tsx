import { Check, X } from 'lucide-react'

const ROWS: { feature: string; cp: boolean | string; manual: boolean | string }[] = [
  { feature: 'Alunos ilimitados no preço único', cp: true, manual: 'Por faixa' },
  { feature: 'Preço não sobe conforme você cresce', cp: true, manual: false },
  { feature: 'Treinos e templates ilimitados', cp: true, manual: 'Limitado' },
  { feature: 'Cadastro por IA (linguagem natural) incluso', cp: true, manual: 'Add-on' },
  { feature: 'App do aluno incluso', cp: true, manual: 'Às vezes' },
  { feature: 'Avaliações, agenda e dashboard inclusos', cp: true, manual: 'Limitado' },
  { feature: 'Sem fidelidade · cancele quando quiser', cp: true, manual: 'Varia' },
  { feature: 'Tudo o que importa em 1 plano só', cp: true, manual: false },
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
            1 plano. Sem pegadinha.
          </h2>
          <p style={{ color: '#475569', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>
            A maioria dos concorrentes atrai com plano barato e esconde limites de alunos, de IA e de recursos. No CoachPilot é um preço único, com tudo o que importa incluso.
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
              <span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>Outros apps</span>
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
