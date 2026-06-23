import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Calendar, LayoutTemplate, Bell, BookOpen, Brain, Settings, LogOut, Menu, X, Newspaper, Trophy, UserCircle, Shield, ChevronUp, HelpCircle, CreditCard, Download, Smartphone } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { useUnreadCount } from '../../hooks/useNotificacoes'
import { personalApi } from '../../api/personal'
import { Avatar } from '../ui'
import { ChatWidget } from '../chat/ChatWidget'
import { ChatContextProvider } from '../../context/ChatContext'
import { TrialBanner } from '../billing/TrialBanner'
import { RenewalBanner } from '../billing/RenewalBanner'
import { usePushPersonal } from '../../hooks/usePushPersonal'
import { useSplash, SplashScreen } from '../ui/SplashScreen'
import { getInstallPrompt } from '../../lib/installPrompt'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/alunos', label: 'Alunos', icon: Users },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/feed', label: 'Feed', icon: Newspaper },
  { to: '/ranking', label: 'Ranking', icon: Trophy },
  { to: '/notificacoes', label: 'Notificações', icon: Bell },
  { to: '/plano', label: 'Plano', icon: CreditCard },
  { to: '/biblioteca', label: 'Biblioteca', icon: BookOpen },
  { to: '/conhecimento', label: 'Base de IA', icon: Brain },
  { to: '/ajuda', label: 'Ajuda', icon: HelpCircle },
]

const TITLE_MAP: Record<string, string> = { '/config': 'Configurações', '/perfil': 'Meu Perfil', '/ajuda': 'Ajuda' }

function SidebarContent({ unread, onNavigate, showInstallBtn, isIos, onInstall }: {
  unread: number
  onNavigate?: () => void
  showInstallBtn?: boolean
  isIos?: boolean
  onInstall?: () => void
}) {
  const { user, signOut, isAdmin } = useAuth()
  const profile = useQuery({ queryKey: ['personal-profile'], queryFn: personalApi.getProfile, staleTime: 300_000 })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const link = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
      active ? 'bg-accent/15 text-accent-hover' : 'text-text-secondary hover:bg-white/5 hover:text-text'
    }`
  const displayName = profile.data?.nome || user?.name || user?.email || 'Personal'

  function closeMenu() {
    setMenuOpen(false)
    onNavigate?.()
  }

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <div className="flex flex-col h-full w-full">
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => link(isActive)}>
            <Icon size={16} /> {label}
            {to === '/notificacoes' && unread > 0 && (
              <span className="ml-auto text-[10px] bg-accent text-white rounded-full px-1.5 min-w-5 text-center leading-5">
                {unread}
              </span>
            )}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/admin" onClick={onNavigate} className={({ isActive }) => link(isActive)}>
            <Shield size={16} /> Admin
          </NavLink>
        )}
      </nav>

      {/* Instalar app */}
      {showInstallBtn && (
        <button
          onClick={onInstall}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-accent-hover hover:bg-accent/10 transition-colors w-full"
        >
          {isIos ? <Smartphone size={16} /> : <Download size={16} />}
          <span>Instalar app</span>
          <span className="ml-auto w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
        </button>
      )}

      {/* User menu — rodapé */}
      <div ref={menuRef} className="relative mt-2 pt-2 border-t border-border/40 shrink-0">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="w-full px-2 flex items-center gap-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <Avatar name={displayName} imageUrl={profile.data?.foto_url} size="sm" />
          <div className="min-w-0 flex-1 text-left">
            <p className="font-display text-sm font-bold text-text truncate">{displayName}</p>
            {profile.data?.descricao && (
              <p className="text-xs text-text-muted truncate">{profile.data.descricao}</p>
            )}
          </div>
          <ChevronUp
            size={14}
            className={`shrink-0 text-text-muted transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Popover abre para cima */}
        {menuOpen && (
          <div className="absolute left-0 right-0 bottom-full z-50 mb-1 rounded-lg border border-border bg-surface-elevated shadow-xl overflow-hidden">
            <NavLink
              to="/perfil"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-sm transition-colors ${isActive ? 'text-accent-hover bg-accent/10' : 'text-text-secondary hover:bg-white/5 hover:text-text'}`
              }
            >
              <UserCircle size={15} /> Meu Perfil
            </NavLink>
            <NavLink
              to="/config"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-sm transition-colors ${isActive ? 'text-accent-hover bg-accent/10' : 'text-text-secondary hover:bg-white/5 hover:text-text'}`
              }
            >
              <Settings size={15} /> Configurações
            </NavLink>
            <div className="border-t border-border/40 my-0.5" />
            <button
              onClick={() => { signOut(); closeMenu() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ImpersonationBanner() {
  const { impersonating, stopImpersonating } = useAuth()
  const navigate = useNavigate()
  if (!impersonating) return null

  function handleStop() {
    stopImpersonating()
    navigate('/admin')
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-xs shrink-0">
      <span>
        Visualizando como <strong>{impersonating.name}</strong>
      </span>
      <button
        onClick={handleStop}
        className="ml-4 px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 transition-colors"
      >
        Sair
      </button>
    </div>
  )
}

export function AppLayout() {
  const unread = useUnreadCount().data?.count ?? 0
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showIosModal, setShowIosModal] = useState(false)
  const [showAndroidModal, setShowAndroidModal] = useState(false)
  const splashVisible = useSplash()
  const location = useLocation()
  const { requestAndSubscribe } = usePushPersonal()

  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const showInstallBtn = !isStandalone

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    requestAndSubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInstall() {
    if (isIos) { setShowIosModal(true); return }
    const prompt = getInstallPrompt()
    if (prompt) { await prompt.prompt(); return }
    setShowAndroidModal(true)
  }

  const pageTitle =
    NAV_ITEMS.find((i) => location.pathname.startsWith(i.to))?.label ??
    TITLE_MAP[location.pathname] ??
    'Personal'

  return (
    <ChatContextProvider>
    <div className="h-screen overflow-hidden flex flex-col">
      <ImpersonationBanner />
      <TrialBanner />
      <RenewalBanner />
      <div className="flex flex-1 min-h-0">
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden lg:flex w-56 shrink-0 border-r border-border bg-surface/60 backdrop-blur-xl p-4">
        <SidebarContent unread={unread} showInstallBtn={showInstallBtn} isIos={isIos} onInstall={handleInstall} />
      </aside>

      {/* Mobile drawer (<lg) */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="relative w-64 max-w-[80vw] h-full bg-surface-elevated border-r border-border p-4 flex flex-col">
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Fechar menu"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-text-secondary hover:bg-white/5 hover:text-text"
            >
              <X size={18} />
            </button>
            <SidebarContent unread={unread} onNavigate={() => setDrawerOpen(false)} showInstallBtn={showInstallBtn} isIos={isIos} onInstall={handleInstall} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Mobile topbar (<lg) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface/60 backdrop-blur-xl sticky top-0 z-30">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            className="p-1.5 rounded-lg text-text-secondary hover:bg-white/5 hover:text-text"
          >
            <Menu size={20} />
          </button>
          <h2 className="font-display font-semibold text-text flex-1 truncate">{pageTitle}</h2>
          <NavLink to="/notificacoes" aria-label="Notificações" className="relative p-1.5 rounded-lg text-text-secondary hover:bg-white/5 hover:text-text">
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 text-[10px] bg-accent text-white rounded-full px-1 min-w-4 text-center leading-4">
                {unread}
              </span>
            )}
          </NavLink>
          {showInstallBtn && (
            <button
              onClick={handleInstall}
              aria-label="Instalar app"
              title="Instalar app no celular"
              className="relative p-1.5 rounded-lg text-accent-hover hover:bg-accent/10 transition-colors"
            >
              <Download size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent animate-pulse" />
            </button>
          )}
          <NavLink to="/ajuda" aria-label="Ajuda" className="p-1.5 rounded-lg text-text-secondary hover:bg-white/5 hover:text-text">
            <HelpCircle size={20} />
          </NavLink>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <ChatWidget />
      </div>
    </div>

    {/* Modal de instruções para iOS */}
    {showIosModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-2xl bg-surface-elevated border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-text">Instalar no iPhone</h3>
            <button onClick={() => setShowIosModal(false)} className="p-1 text-text-secondary hover:text-text">
              <X size={18} />
            </button>
          </div>
          <ol className="space-y-3 text-sm text-text-secondary">
            <li className="flex gap-3">
              <span className="font-bold text-accent shrink-0">1.</span>
              Toque no ícone de compartilhar <strong className="text-text">□↑</strong> na barra do Safari
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-accent shrink-0">2.</span>
              Role e selecione <strong className="text-text">"Adicionar à Tela de Início"</strong>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-accent shrink-0">3.</span>
              Toque em <strong className="text-text">Adicionar</strong>
            </li>
          </ol>
          <button
            onClick={() => setShowIosModal(false)}
            className="w-full py-2 rounded-lg bg-accent/20 text-accent-hover text-sm font-medium hover:bg-accent/30 transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    )}

    {showAndroidModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-2xl bg-surface-elevated border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-text">Instalar no Android</h3>
            <button onClick={() => setShowAndroidModal(false)} className="p-1 text-text-secondary hover:text-text">
              <X size={18} />
            </button>
          </div>
          <ol className="space-y-3 text-sm text-text-secondary">
            <li className="flex gap-3">
              <span className="font-bold text-accent shrink-0">1.</span>
              Toque no menu <strong className="text-text">⋮</strong> do Chrome
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-accent shrink-0">2.</span>
              Selecione <strong className="text-text">"Adicionar à tela inicial"</strong> ou <strong className="text-text">"Instalar app"</strong>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-accent shrink-0">3.</span>
              Confirme tocando em <strong className="text-text">Adicionar</strong>
            </li>
          </ol>
          <button
            onClick={() => setShowAndroidModal(false)}
            className="w-full py-2 rounded-lg bg-accent/20 text-accent-hover text-sm font-medium hover:bg-accent/30 transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    )}

    {splashVisible && <SplashScreen src="/novo-logo-slogan-vertical-semfundo.png" rounded={false} />}
    </ChatContextProvider>
  )
}
