import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

/** Fundo compartilhado das telas de auth (login/signup/forgot), no mesmo estilo do hero da landing. */
export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 50%, #060a14 100%)',
      position: 'relative',
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

      <Link
        to="/"
        style={{
          position: 'absolute', top: 20, left: 20, zIndex: 2,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600,
          textDecoration: 'none', padding: '8px 14px', borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)',
          transition: 'border-color 0.2s, color 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(20,184,166,0.5)'; e.currentTarget.style.color = '#14b8a6' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
      >
        <ArrowLeft size={15} /> Voltar ao site
      </Link>

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="px-4">
        {children}
      </div>
    </div>
  )
}
