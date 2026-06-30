import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, LogIn, Search, Gift } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { adminApi, type Personal } from '../api/admin'
import { useAuth } from '../auth/AuthProvider'

type Tab = 'personais' | 'indicacoes'

export function AdminPage() {
  const { impersonate } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('personais')
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

      <div className="flex gap-2">
        {([['personais', 'Personais'], ['indicacoes', 'Campanha de Indicação']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              tab === key ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'personais' && (
        <>
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
          {error && <p className="text-sm text-red-400">Erro ao carregar personals.</p>}
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
        </>
      )}

      {tab === 'indicacoes' && <IndicacoesTab />}
    </div>
  )
}

function IndicacoesTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-indicacoes'],
    queryFn: adminApi.listIndicacoes,
  })

  const linhas = data?.indicacoes ?? []
  const totalAtivados = linhas.reduce((acc, l) => acc + l.indicacoes_total, 0)
  const totalAssinantes = linhas.reduce((acc, l) => acc + l.indicacoes_convertidas, 0)

  if (isLoading) return <p className="text-sm text-text-muted">Carregando...</p>
  if (error) return <p className="text-sm text-red-400">Erro ao carregar indicações.</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm text-text-secondary">
        <span className="flex items-center gap-1.5"><Gift size={15} className="text-accent" /> {linhas.length} personais</span>
        <span><strong className="text-text">{totalAtivados}</strong> ativados pelo cupom</span>
        <span><strong className="text-text">{totalAssinantes}</strong> viraram assinantes</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-elevated text-text-muted text-xs uppercase tracking-wide">
              <th className="text-left font-medium px-3 py-2">Personal</th>
              <th className="text-left font-medium px-3 py-2">Cupom</th>
              <th className="text-right font-medium px-3 py-2">Ativados</th>
              <th className="text-right font-medium px-3 py-2">Assinantes</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.personal_id} className="border-t border-border">
                <td className="px-3 py-2 min-w-0">
                  <p className="text-text truncate max-w-[180px]">{l.name || '(sem nome)'}</p>
                  <p className="text-xs text-text-muted truncate max-w-[180px]">{l.email}</p>
                </td>
                <td className="px-3 py-2 font-mono text-text-secondary">{l.codigo ?? '—'}</td>
                <td className="px-3 py-2 text-right text-text">{l.indicacoes_total}</td>
                <td className="px-3 py-2 text-right text-text">{l.indicacoes_convertidas}</td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-text-muted">Nenhum personal encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
