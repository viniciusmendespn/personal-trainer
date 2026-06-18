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

export default function LandingPage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/alunos', { replace: true })
    }
  }, [user, isLoading, navigate])

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
    </>
  )
}
