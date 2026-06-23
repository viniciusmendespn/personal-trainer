import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import LandingNavbar from './LandingNavbar'
import HeroSection from './HeroSection'
import FeaturesSection from './FeaturesSection'
import HowItWorksSection from './HowItWorksSection'
import ComparisonSection from './ComparisonSection'
import PricingSection from './PricingSection'
import TestimonialsSection from './TestimonialsSection'
import CtaSection from './CtaSection'
import LandingFooter from './LandingFooter'

function WhatsAppFloat() {
  return (
    <a
      href="https://wa.me/5513991830305?text=Olá!+Gostaria+de+saber+mais+sobre+o+CoachPilot"
      target="_blank"
      rel="noopener noreferrer"
      title="Fale conosco no WhatsApp"
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 50,
        width: 56, height: 56, borderRadius: '50%',
        background: '#25D366',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(37,211,102,0.45)',
        textDecoration: 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(37,211,102,0.6)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(37,211,102,0.45)' }}
    >
      <div style={{
        position: 'absolute', inset: -4, borderRadius: '50%',
        background: 'rgba(37,211,102,0.25)',
        animation: 'pulse-ring 2s ease-out infinite',
      }} />
      <svg viewBox="0 0 24 24" fill="white" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    </a>
  )
}

export default function LandingPage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/alunos', { replace: true })
    }
  }, [user, isLoading, navigate])

  useEffect(() => {
    document.title = 'CoachPilot — Gestão para Personal Trainers'
    document.querySelector('meta[name="description"]')
      ?.setAttribute('content', 'CoachPilot — Plataforma completa para personal trainers. Gerencie alunos, treinos, avaliações físicas e agenda em um só lugar. Experimente grátis.')
    document.querySelector('link[rel="canonical"]')
      ?.setAttribute('href', 'https://coachpilot.com.br/')
  }, [])

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #14b8a6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (user) return null

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .hidden { display: none !important; }
        .lg\\:block { display: none; }
        .lg\\:flex { display: none; }
        @media (min-width: 1024px) {
          .hidden { display: none !important; }
          .lg\\:block { display: block !important; }
          .lg\\:flex { display: flex !important; }
        }
        @media (max-width: 1023px) {
          .flex.lg\\:hidden { display: flex; }
        }
      `}</style>

      <LandingNavbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <ComparisonSection />
        <PricingSection />
        <TestimonialsSection />
        <CtaSection />
      </main>
      <LandingFooter />
      <WhatsAppFloat />
    </>
  )
}
