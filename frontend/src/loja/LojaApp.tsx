import { createContext, useContext, useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Instagram, LogIn, LogOut, ShoppingBag } from 'lucide-react'
import { useLojaAuth } from './useLojaAuth'
import { CatalogoPage } from './pages/CatalogoPage'
import { AnuncioDetailPage } from './pages/AnuncioDetailPage'
import { ComprasPage } from './pages/ComprasPage'
import { LojaLoginPage } from './pages/LojaLoginPage'

type LojaAuthCtx = ReturnType<typeof useLojaAuth>
const AuthCtx = createContext<LojaAuthCtx | null>(null)

export function useLojaAuthContext(): LojaAuthCtx {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useLojaAuthContext fora do LojaApp')
  return ctx
}

function Header() {
  const { user, signOut } = useLojaAuthContext()
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" aria-label="Loja CoachPilot — início" className="flex items-center gap-2.5 shrink-0">
          <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" className="h-12 w-auto" />
          <span className="loja-gradient rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
            Loja
          </span>
        </Link>
        <nav className="flex items-center gap-1.5">
          {user && (
            <Link
              to="/compras"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:text-text hover:bg-white/5 transition-colors"
            >
              <ShoppingBag size={16} />
              <span className="hidden sm:inline">Minhas compras</span>
            </Link>
          )}
          {user ? (
            <button
              onClick={async () => { await signOut(); navigate('/') }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:text-text hover:bg-white/5 transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent-hover transition-colors"
            >
              <LogIn size={16} />
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border mt-12">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="flex flex-col items-center sm:items-start gap-2">
          <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" className="h-9 w-auto" />
          <p className="text-xs text-text-muted max-w-xs text-center sm:text-left">
            Marketplace de pacotes de treino criados por personal trainers.
          </p>
        </div>
        <nav className="flex flex-col items-center sm:items-end gap-1.5 text-xs">
          <Link to="/" className="text-text-secondary hover:text-accent transition-colors">Catálogo</Link>
          <Link to="/compras" className="text-text-secondary hover:text-accent transition-colors">Minhas compras</Link>
          <a href="https://coachpilot.com.br/loja-vendas" className="text-text-secondary hover:text-accent transition-colors">
            Anuncie seu método
          </a>
          <a href="https://coachpilot.com.br" className="text-text-secondary hover:text-accent transition-colors">
            Conheça o CoachPilot
          </a>
          <a
            href="https://instagram.com/coachpilotoficial"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-text-secondary hover:text-accent transition-colors"
          >
            <Instagram size={13} /> @coachpilotoficial
          </a>
        </nav>
      </div>
      <div className="border-t border-border/60">
        <p className="mx-auto max-w-6xl px-4 py-3 text-[11px] text-text-muted text-center sm:text-left">
          © {new Date().getFullYear()} CoachPilot — Loja CoachPilot
        </p>
      </div>
    </footer>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export function LojaApp() {
  const auth = useLojaAuth()
  return (
    <AuthCtx.Provider value={auth}>
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen bg-bg text-text flex flex-col">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<CatalogoPage />} />
              <Route path="/anuncio/:anuncioId" element={<AnuncioDetailPage />} />
              <Route path="/compras" element={<ComprasPage />} />
              <Route path="/login" element={<LojaLoginPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthCtx.Provider>
  )
}
