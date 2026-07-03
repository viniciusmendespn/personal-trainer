import { createContext, useContext } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { LogIn, LogOut, ShoppingBag, Store } from 'lucide-react'
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
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Store size={22} className="text-accent" />
          <span className="font-semibold text-text" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>
            Loja <span className="text-accent">CoachPilot</span>
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
      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
        <p>
          Loja CoachPilot — pacotes de treino criados por personal trainers.
        </p>
        <p>
          Quer vender seu método?{' '}
          <a href="https://coachpilot.com.br/loja-vendas" className="text-accent hover:underline">
            Anuncie no portal
          </a>
        </p>
      </div>
    </footer>
  )
}

export function LojaApp() {
  const auth = useLojaAuth()
  return (
    <AuthCtx.Provider value={auth}>
      <BrowserRouter>
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
