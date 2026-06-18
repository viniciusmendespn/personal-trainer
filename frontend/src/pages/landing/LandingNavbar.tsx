import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { AppLogo } from '../../components/AppLogo'

const NAV_LINKS = [
  { label: 'Funcionalidades', href: '#features' },
  { label: 'Como funciona', href: '#how' },
  { label: 'Comparativo', href: '#compare' },
  { label: 'Preços', href: '#pricing' },
  { label: 'Depoimentos', href: '#testimonials' },
]

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  function scrollTo(href: string) {
    setMenuOpen(false)
    const el = document.querySelector(href)
    if (el) {
      const y = (el as HTMLElement).getBoundingClientRect().top + window.scrollY - 72
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  return (
    <header
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        transition: 'background 0.3s, box-shadow 0.3s',
        background: scrolled ? 'rgba(10,14,26,0.95)' : 'transparent',
        boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.4)' : 'none',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>
          <AppLogo size={36} />
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: '-0.3px' }}>
            Coach<span style={{ color: '#14b8a6' }}>Pilot</span>
          </span>
        </button>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="hidden lg:flex">
          {NAV_LINKS.map(l => (
            <button
              key={l.href}
              onClick={() => scrollTo(l.href)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#14b8a6')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="hidden lg:flex">
          <Link
            to="/login"
            style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '8px 16px', borderRadius: 8, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#14b8a6')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          >
            Entrar
          </Link>
          <Link
            to="/signup"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #10b981)',
              color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none',
              padding: '9px 20px', borderRadius: 8,
              boxShadow: '0 4px 15px rgba(20,184,166,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(20,184,166,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(20,184,166,0.3)' }}
          >
            Começar Grátis
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4 }}
          className="flex lg:hidden"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOpen && (
        <div style={{ background: 'rgba(10,14,26,0.98)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px 24px' }} className="flex lg:hidden flex-col gap-4">
          {NAV_LINKS.map(l => (
            <button
              key={l.href}
              onClick={() => scrollTo(l.href)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: 500, textAlign: 'left', padding: '8px 0' }}
            >
              {l.label}
            </button>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link to="/login" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 500, padding: '10px 0', textAlign: 'center' }}>
              Entrar
            </Link>
            <Link
              to="/signup"
              onClick={() => setMenuOpen(false)}
              style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', color: '#fff', textDecoration: 'none', fontWeight: 600, padding: '12px', borderRadius: 8, textAlign: 'center' }}
            >
              Começar Grátis
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
