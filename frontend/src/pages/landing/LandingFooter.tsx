import { Link } from 'react-router-dom'
import { AppLogo } from '../../components/AppLogo'

const NAV_LINKS = [
  { label: 'Funcionalidades', href: '#features' },
  { label: 'Como funciona', href: '#how' },
  { label: 'Comparativo', href: '#compare' },
  { label: 'Preços', href: '#pricing' },
  { label: 'Depoimentos', href: '#testimonials' },
]

function scrollTo(href: string) {
  const el = document.querySelector(href)
  if (el) window.scrollTo({ top: (el as HTMLElement).getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' })
}

export default function LandingFooter() {
  return (
    <footer style={{
      background: '#060a14',
      borderTop: '1px solid rgba(20,184,166,0.08)',
      padding: '48px 24px 32px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.05,
        backgroundImage: 'radial-gradient(rgba(20,184,166,0.8) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 40, marginBottom: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <AppLogo size={36} />
              <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff' }}>
                Coach<span style={{ color: '#14b8a6' }}>Pilot</span>
              </span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.7, maxWidth: 260 }}>
              Gestão profissional de alunos, treinos e evolução para personal trainers que querem escalar o negócio.
            </p>
          </div>

          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>
              Navegação
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {NAV_LINKS.map(l => (
                <button
                  key={l.href}
                  onClick={() => scrollTo(l.href)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'left', padding: 0, transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#14b8a6')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>
              Conta
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/signup" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#14b8a6')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
              >
                Criar conta grátis
              </Link>
              <Link to="/login" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#14b8a6')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
              >
                Fazer login
              </Link>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            © {new Date().getFullYear()} CoachPilot. Todos os direitos reservados.
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Feito com 💪 para personal trainers brasileiros
          </span>
        </div>
      </div>
    </footer>
  )
}
