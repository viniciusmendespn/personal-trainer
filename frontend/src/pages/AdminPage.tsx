import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, LogIn, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { adminApi, type Personal } from '../api/admin'
import { useAuth } from '../auth/AuthProvider'

export function AdminPage() {
  const { impersonate } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-personals'],
    queryFn: adminApi.listPersonals,
  })

  const filtered = (data?.personals ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleImpersonate(p: Personal) {
    setLoading(p.personal_id)
    try {
      const result = await adminApi.impersonate(p.personal_id)
      queryClient.clear()
      impersonate(p.personal_id, p.name || p.email, result.token)
      navigate('/dashboard')
    } catch {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={20} className="text-accent" />
        <h1 className="font-display font-bold text-lg text-text">Painel Admin</h1>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-surface-elevated border border-border rounded-lg text-text placeholder-text-muted outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {isLoading && <p className="text-sm text-text-muted">Carregando...</p>}

      {error && (
        <p className="text-sm text-red-400">Erro ao carregar personals.</p>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <p className="text-sm text-text-muted">Nenhum personal encontrado.</p>
      )}

      <div className="space-y-2">
        {filtered.map((p) => (
          <div
            key={p.personal_id}
            className="flex items-center justify-between p-3 bg-surface-elevated border border-border rounded-lg"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">{p.name || '(sem nome)'}</p>
              <p className="text-xs text-text-muted truncate">{p.email}</p>
            </div>
            <button
              onClick={() => handleImpersonate(p)}
              disabled={loading === p.personal_id}
              className="ml-3 shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              <LogIn size={13} />
              {loading === p.personal_id ? 'Entrando...' : 'Visualizar como'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
