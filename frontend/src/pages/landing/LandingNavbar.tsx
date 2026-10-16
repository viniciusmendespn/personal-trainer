import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import './public-site.css'

export default function LandingNavbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen])
  const links = [
    { label: 'Plataforma', href: '/#features' },
    { label: 'Inteligência artificial', href: '/#chatgpt' },
    { label: 'Planos', href: '/#pricing' },
    { label: 'Blog', href: '/blog' },
    { label: 'Loja', href: 'https://loja.coachpilot.com.br' },
  ]
  return (
    <header className="cp-header">
      <div className="cp-container cp-nav-inner">
        <Link to="/" aria-label="CoachPilot — início">
          <img
            className="cp-logo"
            src="/novo-logo-slogan-semfundo.png"
            alt="CoachPilot — Gestão completa para personal trainers"
          />
        </Link>
        <nav className="cp-nav-links" aria-label="Navegação principal">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="cp-nav-actions">
          <Link className="cp-login" to="/login">
            Entrar
          </Link>
          <Link className="cp-button" to="/signup">
            Começar grátis <ArrowRight size={14} />
          </Link>
        </div>
        <button
          className="cp-menu-toggle"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-controls="cp-mobile-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {menuOpen && (
        <nav
          id="cp-mobile-navigation"
          className="cp-mobile-menu"
          aria-label="Navegação pelo celular"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link to="/divulgadores">Seja um divulgador</Link>
          <Link to="/login">Entrar na minha conta</Link>
          <Link className="cp-button" to="/signup">
            Começar grátis <ArrowRight size={15} />
          </Link>
        </nav>
      )}
    </header>
  )
}
