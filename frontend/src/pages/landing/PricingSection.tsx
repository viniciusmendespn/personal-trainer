import { Link } from 'react-router-dom'
import { Check, Infinity, Zap, Users, LayoutTemplate, Activity, Calendar, Smartphone, Trophy, Bell } from 'lucide-react'

const FEATURES = [
  { icon: <Infinity size={16} />, label: 'Alunos ilimitados' },
  { icon: <LayoutTemplate size={16} />, label: 'Treinos e templates ilimitados' },
  { icon: <Activity size={16} />, label: 'Avaliações físicas com gráficos de evolução' },
  { icon: <Calendar size={16} />, label: 'Agenda completa com lembretes automáticos' },
  { icon: <Smartphone size={16} />, label: 'App do aluno (PWA) incluso' },
  { icon: <Trophy size={16} />, label: 'Ranking e feed de engajamento' },
  { icon: <Bell size={16} />, label: 'Notificações automáticas' },
  { icon: <Users size={16} />, label: 'Suporte via WhatsApp' },
]

export default function PricingSection() {
  return (
    <section id="pricing" style={{ background: '#fff', padding: '80px 24px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(20,184,166,0.12)',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 16,
          }}>
            <span style={{ color: '#0d9488', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Planos e Preços</span>
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 12 }}>
            Um plano. Tudo incluso.{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Sem surpresas.
            </span>
          </h2>
          <p style={{ color: '#475569', fontSize: 16, maxWidth: 440, margin: '0 auto' }}>
            Sem plano básico, sem limites escondidos. Uma assinatura que te dá acesso total à plataforma.
          </p>
        </div>

        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(160deg, #0f172a 0%, #060a14 100%)',
            borderRadius: 24,
            padding: 40,
            border: '1.5px solid rgba(20,184,166,0.3)',
            boxShadow: '0 20px 60px rgba(20,184,166,0.15)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -60, right: -60,
              width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }} />

            <div style={{
              position: 'absolute', top: 20, right: 20,
              background: 'linear-gradient(135deg, #14b8a6, #10b981)',
              borderRadius: 20, padding: '4px 12px',
            }}>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>⚡ Mais popular</span>
            </div>

            <div style={{ marginBottom: 28, position: 'relative' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(20,184,166,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Zap size={24} color="#14b8a6" />
              </div>
              <div style={{ color: '#14b8a6', fontWeight: 700, fontSize: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Plano Profissional</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }}>R$</span>
                <span style={{ color: '#fff', fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px' }}>69</span>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>,90</span>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>/mês</div>
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>Cancele quando quiser. Sem fidelidade.</p>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 28 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
              {FEATURES.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'rgba(20,184,166,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: '#14b8a6',
                  }}>
                    <Check size={14} strokeWidth={2.5} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
                    <span style={{ color: '#14b8a6' }}>{f.icon}</span>
                    {f.label}
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/signup"
              style={{
                display: 'block', textAlign: 'center',
                background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                color: '#fff', fontWeight: 700, fontSize: 16, textDecoration: 'none',
                padding: '16px', borderRadius: 12,
                boxShadow: '0 8px 24px rgba(20,184,166,0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(20,184,166,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(20,184,166,0.35)' }}
            >
              Começar Grátis Agora
            </Link>

            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 12 }}>
              🔒 Cancele quando quiser · Suporte via WhatsApp
            </p>
          </div>

          <div style={{
            marginTop: 20,
            padding: '16px 20px',
            background: 'rgba(20,184,166,0.06)',
            border: '1px solid rgba(20,184,166,0.15)',
            borderRadius: 12,
            color: '#475569',
            fontSize: 13,
            lineHeight: 1.6,
            textAlign: 'center',
          }}>
            💡 <strong>Como funciona:</strong> Após o cadastro, cadastre seus alunos e monte os primeiros treinos. O acesso completo está disponível imediatamente após a ativação.
          </div>
        </div>
      </div>
    </section>
  )
}
