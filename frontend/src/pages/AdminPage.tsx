import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, LogIn, Search, Gift, Megaphone, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { adminApi, type DivulgadorAdmin, type Personal } from '../api/admin'
import { normalizeText } from '../utils/normalizeText'
import { useAuth } from '../auth/AuthProvider'

type Tab = 'personais' | 'indicacoes' | 'divulgadores'

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
      normalizeText(p.name).includes(normalizeText(search)) ||
      normalizeText(p.email).includes(normalizeText(search)),
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
        {([['personais', 'Personais'], ['indicacoes', 'Campanha de Indicação'], ['divulgadores', 'Divulgadores']] as [Tab, string][]).map(([key, label]) => (
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
      {tab === 'divulgadores' && <DivulgadoresTab />}
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

function DivulgadoresTab() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-divulgadores'],
    queryFn: adminApi.listDivulgadores,
  })
  const [form, setForm] = useState({ email: '', codigo: '', embaixador: false, fundador: false })
  const [msg, setMsg] = useState('')

  const criar = useMutation({
    mutationFn: () => adminApi.criarDivulgador({
      email: form.email, codigo: form.codigo,
      embaixador: form.embaixador, fundador: form.fundador,
    }),
    onSuccess: () => {
      setMsg('Divulgador criado!')
      setForm({ email: '', codigo: '', embaixador: false, fundador: false })
      queryClient.invalidateQueries({ queryKey: ['admin-divulgadores'] })
    },
    onError: (e: { response?: { data?: { detail?: { code?: string } } } }) => {
      setMsg(`Erro: ${e?.response?.data?.detail?.code || 'falha ao criar'}`)
    },
  })

  const repasse = useMutation({
    mutationFn: ({ id, mes, valor }: { id: string; mes: string; valor: number }) =>
      adminApi.marcarRepasse(id, { mes, valor }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-divulgadores'] }),
  })

  function marcarRepasse(d: DivulgadorAdmin) {
    // Repasse do mês ANTERIOR (mês corrente ainda está em curso).
    const [y, m] = d.mes_atual.mes.split('-').map(Number)
    const ant = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    const valor = window.prompt(`Valor repassado a ${d.nome || d.email} referente a ${ant} (R$):`)
    if (!valor) return
    repasse.mutate({ id: d.divulgador_id, mes: ant, valor: parseFloat(valor.replace(',', '.')) })
  }

  const linhas = data?.divulgadores ?? []

  return (
    <div className="space-y-4">
      {/* Criar divulgador */}
      <form
        onSubmit={(e) => { e.preventDefault(); setMsg(''); criar.mutate() }}
        className="p-3 bg-surface-elevated border border-border rounded-lg space-y-2"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted flex items-center gap-1.5">
          <Megaphone size={13} /> Novo divulgador (a conta CoachPilot já deve existir)
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email" required placeholder="E-mail da conta"
            value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            className="flex-1 px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text placeholder-text-muted outline-none focus:ring-1 focus:ring-accent"
          />
          <input
            type="text" required placeholder="Cupom (ex.: MARIA)" maxLength={20}
            value={form.codigo} onChange={(e) => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
            className="w-full sm:w-44 px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text placeholder-text-muted outline-none focus:ring-1 focus:ring-accent font-mono"
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-text-secondary">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={form.embaixador} onChange={(e) => setForm(f => ({ ...f, embaixador: e.target.checked }))} />
            Embaixador (35%)
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={form.fundador} onChange={(e) => setForm(f => ({ ...f, fundador: e.target.checked }))} />
            Fundador
          </label>
          <button
            type="submit" disabled={criar.isPending}
            className="ml-auto px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {criar.isPending ? 'Criando…' : 'Criar'}
          </button>
        </div>
        {msg && <p className={`text-xs ${msg.startsWith('Erro') ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</p>}
      </form>

      {isLoading && <p className="text-sm text-text-muted">Carregando...</p>}
      {error && <p className="text-sm text-red-400">Erro ao carregar divulgadores.</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-elevated text-text-muted text-xs uppercase tracking-wide">
              <th className="text-left font-medium px-3 py-2">Divulgador</th>
              <th className="text-left font-medium px-3 py-2">Cupom</th>
              <th className="text-right font-medium px-3 py-2">Contas</th>
              <th className="text-right font-medium px-3 py-2">Assinantes</th>
              <th className="text-right font-medium px-3 py-2">Comissão do mês</th>
              <th className="text-right font-medium px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((d) => (
              <tr key={d.divulgador_id} className="border-t border-border">
                <td className="px-3 py-2 min-w-0">
                  <p className="text-text truncate max-w-[180px]">
                    {d.nome || '(sem nome)'}
                    {d.embaixador && <span className="ml-1.5 text-[10px] text-accent font-semibold">EMB</span>}
                    {d.fundador && <span className="ml-1 text-[10px] text-amber-400 font-semibold">FND</span>}
                    {!d.ativo && <span className="ml-1 text-[10px] text-red-400 font-semibold">INATIVO</span>}
                  </p>
                  <p className="text-xs text-text-muted truncate max-w-[180px]">{d.email}</p>
                </td>
                <td className="px-3 py-2 font-mono text-text-secondary">{d.codigo}</td>
                <td className="px-3 py-2 text-right text-text">{d.contas_total}</td>
                <td className="px-3 py-2 text-right text-text">{d.assinantes_total}</td>
                <td className="px-3 py-2 text-right text-text">
                  {d.mes_atual.comissao_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <span className="text-xs text-text-muted"> ({Math.round(d.mes_atual.pct * 100)}%)</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => marcarRepasse(d)}
                    disabled={repasse.isPending}
                    title="Marcar repasse do mês anterior como pago"
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-elevated disabled:opacity-50 transition-colors"
                  >
                    <Check size={11} /> Repasse
                  </button>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-text-muted">Nenhum divulgador cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
