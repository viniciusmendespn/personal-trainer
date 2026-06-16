import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Bell, BookOpen, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useUnreadCount } from '../../hooks/useNotificacoes'

export function AppLayout() {
  const { user, signOut } = useAuth()
  const unread = useUnreadCount().data?.count ?? 0
  const link = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
      active ? 'bg-emerald-600/20 text-emerald-300' : 'text-slate-400 hover:bg-slate-800'
    }`

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-slate-800 p-4 flex flex-col gap-1">
        <div className="px-2 mb-4">
          <h1 className="text-lg font-bold text-emerald-400">Personal</h1>
          <p className="text-xs text-slate-500 truncate">{user?.name || user?.email}</p>
        </div>
        <NavLink to="/dashboard" className={({ isActive }) => link(isActive)}>
          <LayoutDashboard size={16} /> Visão geral
        </NavLink>
        <NavLink to="/alunos" className={({ isActive }) => link(isActive)}>
          <Users size={16} /> Alunos
        </NavLink>
        <NavLink to="/notificacoes" className={({ isActive }) => link(isActive)}>
          <Bell size={16} /> Notificações
          {unread > 0 && (
            <span className="ml-auto text-[10px] bg-emerald-600 text-white rounded-full px-1.5 min-w-5 text-center">{unread}</span>
          )}
        </NavLink>
        <NavLink to="/biblioteca" className={({ isActive }) => link(isActive)}>
          <BookOpen size={16} /> Biblioteca
        </NavLink>
        <NavLink to="/config" className={({ isActive }) => link(isActive)}>
          <Settings size={16} /> WhatsApp
        </NavLink>
        <button
          onClick={() => signOut()}
          className="mt-auto flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800"
        >
          <LogOut size={16} /> Sair
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
