import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Calendar, LayoutTemplate, Bell, BookOpen, Brain, Settings, LogOut, Menu, X, Newspaper, Trophy, UserCircle, Shield, ChevronDown, HelpCircle, CreditCard } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { useUnreadCount } from '../../hooks/useNotificacoes'
import { personalApi } from '../../api/personal'
import { Avatar } from '../ui'
import { ChatWidget } from '../chat/ChatWidget'
import { ChatContextProvider } from '../../context/ChatContext'
import { TrialBanner } from '../billing/TrialBanner'
import { RenewalBanner } from '../billing/RenewalBanner'

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

function SidebarContent({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
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
      <div className="shrink-0">
        <div className="px-2 mb-3">
          <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" style={{ height: 22, width: 'auto', maxWidth: '100%' }} />
        </div>

        {/* User menu trigger */}
        <div ref={menuRef} className="relative mb-2">
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
            <ChevronDown
              size={14}
              className={`shrink-0 text-text-muted transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Floating popover */}
          {menuOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-surface-elevated shadow-xl overflow-hidden">
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
  const location = useLocation()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

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
        <SidebarContent unread={unread} />
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
            <SidebarContent unread={unread} onNavigate={() => setDrawerOpen(false)} />
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
    </ChatContextProvider>
  )
}
