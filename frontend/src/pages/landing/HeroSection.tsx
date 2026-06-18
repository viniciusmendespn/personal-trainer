import { Link } from 'react-router-dom'
import { ArrowRight, Users, Smartphone, Sparkles } from 'lucide-react'

const STATS = [
  { icon: <Users size={16} />, label: '+500 alunos gerenciados' },
  { icon: <Smartphone size={16} />, label: 'App do aluno incluso' },
  { icon: <Sparkles size={16} />, label: 'IA integrada' },
]

export default function HeroSection() {
  function scrollToFeatures() {
    const el = document.querySelector('#features')
    if (el) window.scrollTo({ top: (el as HTMLElement).getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' })
  }

  return (
    <section style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 50%, #060a14 100%)',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.15,
        backgroundImage: 'radial-gradient(rgba(20,184,166,0.6) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }} />

      <div style={{
        position: 'absolute', top: '15%', left: '5%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '5%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
        filter: 'blur(40px)',
      }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '100px 24px 80px', position: 'relative', zIndex: 1, width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 60, alignItems: 'center' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)',
              borderRadius: 20, padding: '6px 14px', marginBottom: 24,
            }}>
              <span style={{ fontSize: 16 }}>🚀</span>
              <span style={{ color: '#14b8a6', fontSize: 13, fontWeight: 600 }}>Gestão completa de alunos por R$69,90/mês</span>
            </div>

            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 20, letterSpacing: '-1px' }}>
              Gerencie seus{' '}
              <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                alunos e treinos
              </span>
              {' '}de forma profissional
            </h1>

            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 36, maxWidth: 520 }}>
              Substitua planilhas e anotações soltas por um sistema único: agenda, avaliações físicas, treinos e um app exclusivo para seus alunos.{' '}
              <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Tudo em um só lugar.</strong>
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 48 }}>
              <Link
                to="/signup"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                  color: '#fff', fontWeight: 700, fontSize: 16, textDecoration: 'none',
                  padding: '14px 28px', borderRadius: 12,
                  boxShadow: '0 8px 25px rgba(20,184,166,0.35)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(20,184,166,0.45)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(20,184,166,0.35)' }}
              >
                Começar Grátis Agora <ArrowRight size={18} />
              </Link>
              <button
                onClick={scrollToFeatures}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'transparent', border: '1.5px solid rgba(255,255,255,0.25)',
                  color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: 16, cursor: 'pointer',
                  padding: '14px 28px', borderRadius: 12,
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#14b8a6'; e.currentTarget.style.color = '#14b8a6' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' }}
              >
                Ver como funciona
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {STATS.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)' }}>
                  <span style={{ color: '#14b8a6' }}>{s.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</span>
                  {i < STATS.length - 1 && <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>|</span>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(20,184,166,0.2)',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 420,
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 18 }}>🏋️</span>
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Mariana Souza</div>
                    <div style={{ color: '#14b8a6', fontSize: 12 }}>● Treino do dia: Pernas</div>
                  </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Frequência do mês</span>
                    <span style={{ color: '#14b8a6', fontSize: 12, fontWeight: 600 }}>86%</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: '86%', height: '100%', background: 'linear-gradient(90deg, #14b8a6, #10b981)', borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  {[['18', 'Treinos', '#14b8a6'], ['3', 'Avaliações', 'rgba(255,255,255,0.4)'], ['2º', 'Ranking', '#f59e0b']].map(([n, l, c]) => (
                    <div key={l} style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 4px' }}>
                      <div style={{ color: c as string, fontWeight: 700, fontSize: 18 }}>{n}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Próximos alunos</div>
                {[
                  ['Carla M.', 'Avaliação física', '08:00'],
                  ['Pedro A.', 'Treino de costas', '09:30'],
                  ['Júlia R.', 'Treino funcional', '11:00'],
                ].map(([name, label, time]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#14b8a6', fontSize: 11, fontWeight: 700 }}>{name[0]}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500 }}>{name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{label}</div>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, lineHeight: 0 }}>
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
          <path d="M0,30 C360,60 720,0 1080,30 L1080,60 L0,60 Z" fill="#f0fdfa" opacity="0.03" />
          <path d="M0,40 C480,10 960,70 1440,40 L1440,60 L0,60 Z" fill="#f0fdfa" opacity="0.05" />
        </svg>
      </div>
    </section>
  )
}
