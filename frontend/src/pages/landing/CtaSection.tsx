import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function CtaSection() {
  return (
    <section style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #0d9488 50%, #14b8a6 100%)',
      padding: '80px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.1,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
        backgroundSize: '25px 25px',
      }} />

      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
        filter: 'blur(30px)',
      }} />

      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 20, padding: '6px 16px', marginBottom: 24,
        }}>
          <span style={{ fontSize: 16 }}>💪</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Grátis até 3 alunos · Gestão Pro R$39,90/mês ↓ de R$69,90</span>
        </div>

        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 5vw, 50px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 18, letterSpacing: '-1px' }}>
          Comece grátis e profissionalize sua{' '}
          <span style={{ background: 'rgba(255,255,255,0.9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            gestão de alunos
          </span>
        </h2>

        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, lineHeight: 1.6, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px' }}>
          Cadastre até 3 alunos sem pagar nada. Quando quiser crescer, desbloqueie alunos ilimitados por R$39,90/mês (de R$69,90) — preço de lançamento.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14 }}>
          <Link
            to="/signup"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#fff',
              color: '#0d9488', fontWeight: 700, fontSize: 16, textDecoration: 'none',
              padding: '16px 32px', borderRadius: 12,
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)' }}
          >
            Criar Conta Grátis <ArrowRight size={18} />
          </Link>
          <button
            onClick={() => {
              const el = document.querySelector('#pricing')
              if (el) window.scrollTo({ top: (el as HTMLElement).getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' })
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              border: '1.5px solid rgba(255,255,255,0.3)',
              color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer',
              padding: '16px 28px', borderRadius: 12,
              transition: 'background 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
          >
            Ver planos
          </button>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 20 }}>
          Sem fidelidade · Sem cartão obrigatório na entrada · Add-ons opcionais de WhatsApp e IA
        </p>
      </div>
    </section>
  )
}
