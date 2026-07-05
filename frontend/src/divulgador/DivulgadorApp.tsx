import { createContext, useContext, useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Instagram, LogIn, LogOut, Users } from 'lucide-react'
import { useDivulgadorAuth } from './useDivulgadorAuth'
import { divulgadorApi } from '../api/divulgador'
import { PainelPage } from './pages/PainelPage'
import { ClientesPage } from './pages/ClientesPage'
import { DivLoginPage } from './pages/DivLoginPage'
import { PainelExclusivo } from './components/PainelExclusivo'

function useDivulgadorStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['div-status'],
    queryFn: divulgadorApi.status,
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

type DivAuthCtx = ReturnType<typeof useDivulgadorAuth>
const AuthCtx = createContext<DivAuthCtx | null>(null)

export function useDivAuthContext(): DivAuthCtx {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useDivAuthContext fora do DivulgadorApp')
  return ctx
}

function Header() {
  const { user, signOut } = useDivAuthContext()
  const navigate = useNavigate()
  const { data: status } = useDivulgadorStatus(!!user)
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto max-w-4xl px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" aria-label="Painel do Divulgador — início" className="flex items-center gap-2.5 shrink-0">
          <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" className="h-12 w-auto" />
          <span className="loja-gradient rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
            Divulgador
          </span>
        </Link>
        <nav className="flex items-center gap-1.5">
          {user && status?.is_divulgador && (
            <Link
              to="/clientes"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:text-text hover:bg-white/5 transition-colors"
            >
              <Users size={16} />
              <span className="hidden sm:inline">Meus indicados</span>
            </Link>
          )}
          {user ? (
            <button
              onClick={async () => { await signOut(); navigate('/login') }}
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
      <div className="mx-auto max-w-4xl px-4 py-8 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="flex flex-col items-center sm:items-start gap-2">
          <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" className="h-9 w-auto" />
          <p className="text-xs text-text-muted max-w-xs text-center sm:text-left">
            Programa de divulgadores CoachPilot — comissão recorrente sobre o Gestão Pro.
          </p>
        </div>
        <nav className="flex flex-col items-center sm:items-end gap-1.5 text-xs">
          <a href="https://coachpilot.com.br/divulgadores" className="text-text-secondary hover:text-accent transition-colors">
            Regras do programa
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
        <p className="mx-auto max-w-4xl px-4 py-3 text-[11px] text-text-muted text-center sm:text-left">
          © {new Date().getFullYear()} CoachPilot — Painel do Divulgador
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useDivAuthContext()
  const { pathname } = useLocation()
  if (loading) return <div className="py-24 text-center text-text-muted text-sm">Carregando…</div>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />
  return <>{children}</>
}

function RequireDivulgador({ children }: { children: React.ReactNode }) {
  const { user } = useDivAuthContext()
  const { data: status, isLoading } = useDivulgadorStatus(!!user)
  if (isLoading) return <div className="py-24 text-center text-text-muted text-sm">Carregando…</div>
  if (!status?.is_divulgador) return <PainelExclusivo />
  return <>{children}</>
}

export function DivulgadorApp() {
  const auth = useDivulgadorAuth()
  return (
    <AuthCtx.Provider value={auth}>
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen bg-bg text-text flex flex-col">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<RequireAuth><RequireDivulgador><PainelPage /></RequireDivulgador></RequireAuth>} />
              <Route path="/clientes" element={<RequireAuth><RequireDivulgador><ClientesPage /></RequireDivulgador></RequireAuth>} />
              <Route path="/login" element={<DivLoginPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthCtx.Provider>
  )
}
