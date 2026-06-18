import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, Calendar, LayoutTemplate, Bell, BookOpen, Settings, LogOut, Menu, X, Newspaper, Trophy, UserCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { useUnreadCount } from '../../hooks/useNotificacoes'
import { personalApi } from '../../api/personal'
import { Avatar } from '../ui'
import { ChatWidget } from '../chat/ChatWidget'
import { ChatContextProvider } from '../../context/ChatContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/alunos', label: 'Alunos', icon: Users },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/feed', label: 'Feed', icon: Newspaper },
  { to: '/ranking', label: 'Ranking', icon: Trophy },
  { to: '/notificacoes', label: 'Notificações', icon: Bell },
  { to: '/biblioteca', label: 'Biblioteca', icon: BookOpen },
  { to: '/config', label: 'WhatsApp', icon: Settings },
  { to: '/perfil', label: 'Meu Perfil', icon: UserCircle },
]

function SidebarContent({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
  const { user, signOut } = useAuth()
  const profile = useQuery({ queryKey: ['personal-profile'], queryFn: personalApi.getProfile, staleTime: 300_000 })
  const link = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
      active ? 'bg-accent/15 text-accent-hover' : 'text-text-secondary hover:bg-white/5 hover:text-text'
    }`
  const displayName = profile.data?.nome || user?.name || user?.email || 'Personal'

  return (
    <div className="flex flex-col gap-1 h-full w-full">
      <div className="px-2 mb-4 flex items-center gap-2">
        <Avatar name={displayName} imageUrl={profile.data?.foto_url} size="sm" />
        <div className="min-w-0">
          <h1 className="font-display text-sm font-bold text-text truncate">{displayName}</h1>
          {profile.data?.descricao && (
            <p className="text-xs text-text-muted truncate">{profile.data.descricao}</p>
          )}
        </div>
      </div>
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
      <button
        onClick={() => signOut()}
        className="mt-auto flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/5 hover:text-text"
      >
        <LogOut size={16} /> Sair
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

  const pageTitle = NAV_ITEMS.find((i) => location.pathname.startsWith(i.to))?.label ?? 'Personal'

  return (
    <ChatContextProvider>
    <div className="h-screen overflow-hidden flex">
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
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <ChatWidget />
    </div>
    </ChatContextProvider>
  )
}
