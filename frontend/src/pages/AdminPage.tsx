import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, LogIn, Search, Gift, Megaphone, Check, Trash2, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { adminApi, type DivulgadorAdmin, type Personal } from '../api/admin'
import { AdminDivulgadorDetail } from './admin/AdminDivulgadorDetail'
import { normalizeText } from '../utils/normalizeText'
import { useAuth } from '../auth/AuthProvider'
import { Tabs, Modal, Button, useToast, useConfirm } from '../components/ui'

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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={20} className="text-accent" />
        <h1 className="font-display font-bold text-lg text-text">Painel Admin</h1>
      </div>

      <Tabs
        className="mb-4"
        tabs={[
          { key: 'personais', label: 'Personais' },
          { key: 'indicacoes', label: 'Campanha de Indicação' },
          { key: 'divulgadores', label: 'Divulgadores' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
      />

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

const ERRO_DIVULGADOR: Record<string, string> = {
  CONTA_NAO_ENCONTRADA: 'Esta conta não existe no CoachPilot — o divulgador precisa criar a conta grátis primeiro.',
  CODIGO_JA_EXISTE: 'Este código de cupom já está em uso — escolha outro.',
  CODIGO_INVALIDO: 'Código inválido: use 3 a 20 letras/números (hífen permitido).',
  DIVULGADOR_JA_CADASTRADO: 'Esta conta já é divulgadora.',
  DIVULGADOR_COM_CLIENTES: 'Este divulgador já tem contas indicadas — desative em vez de excluir.',
}

function mesAnterior(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function mesExtenso(ym: string): string {
  const [y, m] = ym.split('-')
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${nomes[parseInt(m, 10) - 1]}/${y}`
}

function DivulgadoresTab() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-divulgadores'],
    queryFn: adminApi.listDivulgadores,
  })
  // Contas reais do Cognito — o divulgador é SELECIONADO, nunca digitado livremente.
  const personals = useQuery({ queryKey: ['admin-personals'], queryFn: adminApi.listPersonals })
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<Personal | null>(null)
  const [form, setForm] = useState({ codigo: '', embaixador: false })
  const [msg, setMsg] = useState('')
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [repasseAlvo, setRepasseAlvo] = useState<DivulgadorAdmin | null>(null)
  const [repasseValor, setRepasseValor] = useState('')

  const jaDivulgador = new Set((data?.divulgadores ?? []).map(d => d.email.toLowerCase()))
  const candidatos = busca.trim().length >= 2 && !selecionado
    ? (personals.data?.personals ?? [])
        .filter(p => !jaDivulgador.has(p.email.toLowerCase()))
        .filter(p => normalizeText(p.name).includes(normalizeText(busca)) || normalizeText(p.email).includes(normalizeText(busca)))
        .slice(0, 6)
    : []

  function erroMsg(e: { response?: { data?: { detail?: { code?: string } } } }): string {
    const code = e?.response?.data?.detail?.code || ''
    return ERRO_DIVULGADOR[code] || 'Falha na operação — tente novamente.'
  }

  const criar = useMutation({
    mutationFn: () => adminApi.criarDivulgador({
      email: selecionado!.email, codigo: form.codigo,
      embaixador: form.embaixador,
    }),
    onSuccess: () => {
      setMsg('Divulgador criado!')
      setForm({ codigo: '', embaixador: false })
      setSelecionado(null)
      setBusca('')
      queryClient.invalidateQueries({ queryKey: ['admin-divulgadores'] })
    },
    onError: (e: { response?: { data?: { detail?: { code?: string } } } }) => setMsg(`Erro: ${erroMsg(e)}`),
  })

  const excluir = useMutation({
    mutationFn: (id: string) => adminApi.excluirDivulgador(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-divulgadores'] }),
    onError: (e: { response?: { data?: { detail?: { code?: string } } } }) => toast.show(erroMsg(e), 'error'),
  })

  const repasse = useMutation({
    mutationFn: ({ id, mes, valor }: { id: string; mes: string; valor: number }) =>
      adminApi.marcarRepasse(id, { mes, valor }),
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: ['admin-divulgadores'] })
      queryClient.invalidateQueries({ queryKey: ['admin-div-painel', v.id] })
      setRepasseAlvo(null)
      setRepasseValor('')
      toast.show('Repasse registrado.', 'success')
    },
    onError: (e: { response?: { data?: { detail?: { code?: string } } } }) => toast.show(erroMsg(e), 'error'),
  })

  // Repasse do mês ANTERIOR (mês corrente ainda está em curso).
  const mesRepasse = repasseAlvo ? mesAnterior(repasseAlvo.mes_atual.mes) : ''

  function marcarRepasse(d: DivulgadorAdmin) {
    setRepasseValor('')
    setRepasseAlvo(d)
  }

  function confirmarRepasse() {
    if (!repasseAlvo) return
    const valor = parseFloat(repasseValor.replace(',', '.'))
    if (!valor || valor <= 0) {
      toast.show('Informe um valor válido.', 'error')
      return
    }
    repasse.mutate({ id: repasseAlvo.divulgador_id, mes: mesRepasse, valor })
  }

  async function confirmarExclusao(d: DivulgadorAdmin) {
    const ok = await confirm({
      title: 'Excluir divulgador',
      message: <>Excluir o divulgador <strong>{d.nome || d.email}</strong>? O código <strong>{d.codigo}</strong> será liberado para reuso.</>,
      confirmLabel: 'Excluir',
      tone: 'danger',
    })
    if (ok) excluir.mutate(d.divulgador_id)
  }

  const linhas = data?.divulgadores ?? []

  const repasseModal = (
    <Modal open={!!repasseAlvo} onClose={() => setRepasseAlvo(null)} title="Marcar repasse">
      {repasseAlvo && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Repasse a <strong className="text-text">{repasseAlvo.nome || repasseAlvo.email}</strong> referente a{' '}
            <strong className="text-text">{mesExtenso(mesRepasse)}</strong> (mês fechado). Informe o valor
            efetivamente transferido via PIX.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">Valor transferido (R$)</label>
            <input
              type="text" inputMode="decimal" autoFocus placeholder="0,00"
              value={repasseValor}
              onChange={(e) => setRepasseValor(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmarRepasse() }}
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text placeholder-text-muted outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setRepasseAlvo(null)}>Cancelar</Button>
            <Button type="button" variant="primary" onClick={confirmarRepasse} disabled={repasse.isPending}>
              {repasse.isPending ? 'Registrando…' : 'Confirmar repasse'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )

  const detalhe = detalheId ? linhas.find(d => d.divulgador_id === detalheId) : null

  if (detalhe) {
    return (
      <>
        <AdminDivulgadorDetail
          d={detalhe}
          onBack={() => setDetalheId(null)}
          onRepasse={marcarRepasse}
        />
        {repasseModal}
      </>
    )
  }

  return (
    <div className="space-y-4">
      {/* Criar divulgador — seleção de conta existente, nunca e-mail digitado livre */}
      <form
        onSubmit={(e) => { e.preventDefault(); setMsg(''); if (selecionado) criar.mutate() }}
        className="p-3 bg-surface-elevated border border-border rounded-lg space-y-2"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted flex items-center gap-1.5">
          <Megaphone size={13} /> Novo divulgador — busque uma conta existente
        </p>
        {!selecionado ? (
          <div className="space-y-1.5">
            <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder={personals.isLoading ? 'Carregando contas…' : 'Buscar conta por nome ou e-mail (mín. 2 letras)'}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              disabled={personals.isLoading}
              className="w-full pl-9 pr-3 py-2 text-sm bg-bg border border-border rounded-lg text-text placeholder-text-muted outline-none focus:ring-1 focus:ring-accent"
            />
            {candidatos.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-surface-elevated border border-border rounded-lg overflow-hidden shadow-lg">
                {candidatos.map((p) => (
                  <button
                    key={p.personal_id} type="button"
                    onClick={() => { setSelecionado(p); setMsg('') }}
                    className="w-full text-left px-3 py-2 hover:bg-accent/10 transition-colors"
                  >
                    <p className="text-sm text-text truncate">{p.name || '(sem nome)'}</p>
                    <p className="text-xs text-text-muted truncate">{p.email}</p>
                  </button>
                ))}
              </div>
            )}
            </div>
            {busca.trim().length >= 2 && !personals.isLoading && candidatos.length === 0 && (
              <p className="text-xs text-text-muted">
                Nenhuma conta encontrada com "{busca}". O divulgador precisa criar a conta grátis em coachpilot.com.br/signup primeiro.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-bg border border-accent/40 rounded-lg">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">{selecionado.name || '(sem nome)'}</p>
              <p className="text-xs text-text-muted truncate">{selecionado.email}</p>
            </div>
            <button
              type="button" onClick={() => { setSelecionado(null); setBusca('') }}
              className="text-xs text-text-secondary hover:text-text shrink-0"
            >
              Trocar
            </button>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="text" required placeholder="Cupom (ex.: MARIA)" maxLength={20}
            value={form.codigo} onChange={(e) => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
            className="w-full sm:w-44 px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text placeholder-text-muted outline-none focus:ring-1 focus:ring-accent font-mono"
          />
          <label className="flex items-center gap-1.5 text-sm text-text-secondary">
            <input type="checkbox" checked={form.embaixador} onChange={(e) => setForm(f => ({ ...f, embaixador: e.target.checked }))} />
            Embaixador (35%)
          </label>
          <button
            type="submit" disabled={criar.isPending || !selecionado || !form.codigo}
            className="sm:ml-auto px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {criar.isPending ? 'Criando…' : 'Criar divulgador'}
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
                    {!d.ativo && <span className="ml-1 text-[10px] text-red-400 font-semibold">INATIVO</span>}
                  </p>
                  <p className="text-xs text-text-muted truncate max-w-[180px]">{d.email}</p>
                </td>
                <td className="px-3 py-2 text-right text-text">{d.contas_total}</td>
                <td className="px-3 py-2 text-right text-text">{d.assinantes_total}</td>
                <td className="px-3 py-2 text-right text-text">
                  {d.mes_atual.comissao_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <span className="text-xs text-text-muted"> ({Math.round(d.mes_atual.pct * 100)}%)</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => setDetalheId(d.divulgador_id)}
                      title="Ver painel detalhado do divulgador"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-elevated transition-colors"
                    >
                      <BarChart3 size={11} /> Ver painel
                    </button>
                    <button
                      onClick={() => marcarRepasse(d)}
                      disabled={repasse.isPending}
                      title="Marcar repasse do mês anterior como pago"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-elevated disabled:opacity-50 transition-colors"
                    >
                      <Check size={11} /> Repasse
                    </button>
                    {d.contas_total === 0 && (
                      <button
                        onClick={() => confirmarExclusao(d)}
                        disabled={excluir.isPending}
                        title="Excluir divulgador (sem clientes — libera o código)"
                        className="inline-flex items-center px-2 py-1 text-[11px] font-medium border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && !isLoading && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-text-muted">Nenhum divulgador cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {repasseModal}
    </div>
  )
}
