import { Star } from 'lucide-react'

const TESTIMONIALS = [
  {
    quote: 'Em 1 mês usando o CoachPilot, parei de perder tempo procurando ficha de treino em planilha. Meus alunos adoram o app — eles veem o treino do dia e a evolução deles sem precisar me perguntar nada.',
    name: 'Rafael Martins',
    role: 'Personal Trainer Autônomo',
    initial: 'R',
    color: '#14b8a6',
  },
  {
    quote: 'A agenda com lembretes automáticos resolveu o problema de aluno esquecendo horário. E o ranking deixou meus alunos muito mais engajados — virou até uma competição saudável entre eles.',
    name: 'Beatriz Lima',
    role: 'Dona de Studio de Treinamento',
    initial: 'B',
    color: '#10b981',
  },
]

function Stars() {
  return (
    <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
      {[...Array(5)].map((_, i) => (
        <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />
      ))}
    </div>
  )
}

export default function TestimonialsSection() {
  return (
    <section id="testimonials" style={{
      background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 100%)',
      padding: '80px 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(20,184,166,0.12)',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 16,
          }}>
            <span style={{ color: '#14b8a6', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Depoimentos</span>
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', marginBottom: 12 }}>
            Quem usa,{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              recomenda
            </span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, maxWidth: 440, margin: '0 auto' }}>
            Veja o que personal trainers dizem sobre os resultados que alcançaram.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: 32,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                transition: 'transform 0.25s, box-shadow 0.25s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 40px rgba(0,0,0,0.3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)' }}
            >
              <Stars />

              <div style={{ color: t.color, fontSize: 64, fontFamily: 'serif', lineHeight: 0.6, marginBottom: 20, opacity: 0.3 }}>"</div>

              <p style={{ color: '#374151', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
                {t.quote}
              </p>

              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${t.color}, ${t.color}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0,
                }}>
                  {t.initial}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: 15 }}>{t.name}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
