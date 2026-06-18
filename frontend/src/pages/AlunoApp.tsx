import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, TrendingUp, MessageCircle, History, Trophy, Check, ChevronRight, ChevronDown, Video, Timer, Clock, Bell, AlertTriangle, HelpCircle, Wrench, X, BarChart3, Search, Camera, Newspaper } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { alunoApi, type ExSessao, type SessaoAtiva, type SessaoHistorico } from '../api/alunoApp'
import { SeriesPrescritasCompact } from '../components/exercicios/SeriesPrescritasEditor'
import { AlunoSessaoDetalheCard } from '../components/historico/SessaoDetalheCard'
import { ALUNO_TOKEN_KEY } from '../api/alunoClient'
import { FeedGlobalTab } from '../components/feed/FeedGlobalTab'
import { PontosWidget } from '../components/gamificacao/PontosWidget'
import { RankingList } from '../components/gamificacao/RankingList'
import { useAlunoChat, useSendAlunoChat, useSendDiretoAlunoChat } from '../hooks/useAlunoChat'
import { useAlunoTimeline } from '../hooks/useAlunoTimeline'
import { ChatThread } from '../components/chat/ChatThread'
import { ChatInputBar } from '../components/chat/ChatInputBar'
import { ExercicioFeedCard } from '../components/exercicio/ExercicioFeedCard'
import { PostComposer } from '../components/exercicio/PostComposer'
import { Button, Card, Spinner, Input, Badge, StatCard, EmptyState, SearchableSelect, useToast, useConfirm } from '../components/ui'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: 'var(--color-text)',
  fontSize: 12,
}
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 12 }

function formatDiaCompleto(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === hoje.toDateString()) return 'hoje'
  if (d.toDateString() === ontem.toDateString()) return 'ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-6 text-center text-text-secondary">{children}</div>
}

function useAlunoToken() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ALUNO_TOKEN_KEY))
  useEffect(() => {
    const u = new URL(window.location.href)
    const t = u.searchParams.get('token')
    if (t) {
      localStorage.setItem(ALUNO_TOKEN_KEY, t)
      setToken(t)
      u.searchParams.delete('token')
      window.history.replaceState({}, '', u.pathname)
    }
  }, [])
  return token
}

function NotifBell({ onNavigate }: { onNavigate: (tab: 'evolucao' | 'historico', exId?: string) => void }) {
  const count = useQuery({
    queryKey: ['aluno-notif-count'],
    queryFn: alunoApi.notificacoesCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const [open, setOpen] = useState(false)
  const n = count.data?.nao_lidas ?? 0
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-1 text-text-muted hover:text-text transition-colors"
        aria-label="Notificações"
      >
        <Bell size={20} />
        {n > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-danger text-[10px] font-bold text-white flex items-center justify-center px-0.5">
            {n > 9 ? '9+' : n}
          </span>
        )}
      </button>
      {open && <NotifDrawer onClose={() => setOpen(false)} onNavigate={onNavigate} />}
    </>
  )
}

const ANOTIF_ICON: Record<string, React.ReactNode> = {
  DOR_RESPONDIDA: <AlertTriangle size={14} className="text-danger" />,
  DUVIDA_RESPONDIDA: <HelpCircle size={14} className="text-info" />,
  MSG_PERSONAL: <MessageCircle size={14} className="text-energy" />,
  CORRECAO_EXERCICIO: <Wrench size={14} className="text-accent-hover" />,
  MIDIA_PERSONAL: <Camera size={14} className="text-info" />,
}

const DEEP_LINK_TIPOS = ['DOR_RESPONDIDA', 'DUVIDA_RESPONDIDA', 'CORRECAO_EXERCICIO', 'MIDIA_PERSONAL']

function NotifDrawer({ onClose, onNavigate }: { onClose: () => void; onNavigate: (tab: 'evolucao' | 'historico', exId?: string) => void }) {
  const qc = useQueryClient()
  const notifs = useQuery({
    queryKey: ['aluno-notifs'],
    queryFn: () => alunoApi.notificacoes({ limit: 30 }),
  })
  const items = notifs.data?.items ?? []

  async function handleClick(n: typeof items[number]) {
    if (!n.lida) {
      await alunoApi.marcarNotificacaoLida(n.ref)
      qc.invalidateQueries({ queryKey: ['aluno-notifs'] })
      qc.invalidateQueries({ queryKey: ['aluno-notif-count'] })
    }
    if (DEEP_LINK_TIPOS.includes(n.tipo) && n.exercicio_id) {
      onNavigate('evolucao', n.exercicio_id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="bg-surface-elevated rounded-t-2xl shadow-lg max-h-[70vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Notificações</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {notifs.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
          {!notifs.isLoading && !items.length && (
            <p className="text-sm text-text-muted text-center py-8">Nenhuma notificação ainda.</p>
          )}
          {items.map((n) => (
            <button
              key={n.ref}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-white/5 ${n.lida ? 'opacity-60' : ''}`}
              onClick={() => handleClick(n)}
            >
              <div className="mt-0.5 shrink-0">{ANOTIF_ICON[n.tipo] ?? <Bell size={14} className="text-text-muted" />}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text leading-tight">{n.titulo}</p>
                <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.mensagem}</p>
                <p className="text-[10px] text-text-muted mt-1">{new Date(n.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                {DEEP_LINK_TIPOS.includes(n.tipo) && n.exercicio_id && (
                  <p className="text-[10px] text-accent-hover mt-0.5">Toque para ver</p>
                )}
              </div>
              {!n.lida && <span className="w-2 h-2 rounded-full bg-energy shrink-0 mt-1.5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AlunoApp() {
  const token = useAlunoToken()
  const [tab, setTab] = useState<'hoje' | 'evolucao' | 'historico' | 'feed'>('hoje')
  const [highlightExId, setHighlightExId] = useState<string | undefined>(undefined)
  const [chatOpen, setChatOpen] = useState(false)
  const [showRanking, setShowRanking] = useState(false)
  const me = useQuery({ queryKey: ['aluno-me'], queryFn: alunoApi.me, enabled: !!token, retry: false })

  function handleNotifNavigate(dest: 'evolucao' | 'historico', exId?: string) {
    setTab(dest)
    if (exId) setHighlightExId(exId)
  }

  if (!token) return <Centered>Abra o aplicativo pelo link enviado no seu WhatsApp.</Centered>
  if (me.isError) return <Centered>Seu link expirou. Peça um novo ao seu personal no WhatsApp.</Centered>

  return (
    <div
      className="min-h-screen max-w-md mx-auto flex flex-col"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <header className="px-4 pt-4 pb-2 shrink-0 flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-text">Olá, {me.data?.nome ?? 'aluno'}</h1>
        {token && <NotifBell onNavigate={handleNotifNavigate} />}
      </header>
      {tab === 'historico' ? (
        <main className="px-4 flex-1"><HistoricoTab /></main>
      ) : tab === 'feed' ? (
        <main className="px-4 flex-1 pt-2"><FeedGlobalTab /></main>
      ) : tab === 'evolucao' ? (
        <main className="px-4 flex-1"><Evolucao initialExId={highlightExId} /></main>
      ) : (
        <main className="px-4 flex-1">
          {showRanking ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowRanking(false)} className="text-text-muted hover:text-text transition-colors">
                  <X size={18} />
                </button>
                <h2 className="font-semibold text-sm flex items-center gap-2"><Trophy size={16} className="text-energy" />Ranking</h2>
              </div>
              <RankingList />
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <PontosWidget onVerRanking={() => setShowRanking(true)} />
              <Hoje />
            </div>
          )}
        </main>
      )}

      {/* FAB — Chat */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed right-4 z-40 w-12 h-12 rounded-full bg-energy shadow-lg flex items-center justify-center text-black transition-transform hover:scale-105 active:scale-95"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        aria-label="Abrir chat"
      >
        <MessageCircle size={22} />
      </button>

      {/* Chat drawer */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <header className="shrink-0 h-14 flex items-center px-4 gap-3 border-b border-border bg-surface-elevated">
            <button onClick={() => setChatOpen(false)} className="text-text-secondary hover:text-text"><X size={20} /></button>
            <span className="text-sm font-medium text-text">Chat com o agente</span>
          </header>
          <ChatTab />
        </div>
      )}

      <nav
        className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-surface-elevated/80 backdrop-blur-xl border-t border-border flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {([
          ['hoje', 'Treino', <Dumbbell size={18} />],
          ['evolucao', 'Evolução', <TrendingUp size={18} />],
          ['historico', 'Histórico', <History size={18} />],
          ['feed', 'Feed', <Newspaper size={18} />],
        ] as const).map(
          ([k, label, icon]) => (
            <button key={k} onClick={() => { setTab(k); setShowRanking(false) }}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs transition-colors ${tab === k ? 'text-energy' : 'text-text-muted'}`}>
              {icon}{label}
            </button>
          ),
        )}
      </nav>
    </div>
  )
}

function ChatTab() {
  const { messages, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAlunoChat()
  const send = useSendAlunoChat()
  const sendDireto = useSendDiretoAlunoChat()
  const { show } = useToast()
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ChatThread
        messages={messages ?? []}
        isLoading={isLoading}
        isSending={send.isPending}
        viewerRole="ALUNO"
        onLoadMore={() => fetchNextPage()}
        hasMore={hasNextPage}
        isLoadingMore={isFetchingNextPage}
      />
      <ChatInputBar
        onSend={(text) => send.mutate(text)}
        onSendDireto={(text) => sendDireto.mutate(text, { onSuccess: () => show('Enviado direto pro seu personal.', 'success') })}
        disabled={send.isPending || sendDireto.isPending}
      />
    </div>
  )
}

function Hoje() {
  const qc = useQueryClient()
  const sessao = useQuery({ queryKey: ['aluno-sessao'], queryFn: alunoApi.sessao, retry: false })
  const hoje = useQuery({ queryKey: ['aluno-hoje'], queryFn: alunoApi.hoje, retry: false })
  const start = useMutation({
    mutationFn: (id: string) => alunoApi.start(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-sessao'] })
      qc.invalidateQueries({ queryKey: ['aluno-sessao-exs'] })
    },
  })

  if (sessao.isLoading) return <Spinner />
  if (sessao.data?.sessao_id) return <SessaoTreino sessao={sessao.data} />

  const agendados = hoje.data?.hoje ?? []
  const lista = agendados.length ? agendados : (hoje.data?.treinos ?? []).map((t) => ({ id: t.treino_id, nome: t.nome }))
  const ultimo = hoje.data?.ultimo
  const proximo = hoje.data?.proximo

  return (
    <div className="space-y-3">
      {(ultimo || proximo) && (
        <Card variant="elevated" className="space-y-1.5">
          {ultimo && (
            <p className="text-xs text-text-secondary">
              <span className="text-text-muted">Último treino:</span>{' '}
              <span className="font-medium text-text">{ultimo.treino_nome ?? '—'}</span>
              {ultimo.data && <span className="text-text-muted"> · {formatDiaCompleto(ultimo.data)}</span>}
            </p>
          )}
          {proximo && (
            <p className="text-xs text-text-secondary">
              <span className="text-text-muted">Próximo:</span>{' '}
              <span className="font-medium text-energy">{proximo.nome ?? '—'}</span>
            </p>
          )}
        </Card>
      )}

      <h2 className="font-display font-semibold">{agendados.length ? 'Treino de hoje' : 'Escolha um treino'}</h2>
      {!lista.length ? (
        <EmptyState icon={<Dumbbell />} title="Nenhum treino cadastrado ainda" />
      ) : (
        lista.map((t) => (
          <Card key={t.id} variant="elevated" className="flex items-center justify-between">
            <span className="font-medium">{t.nome}</span>
            <Button variant="energy" onClick={() => start.mutate(t.id)} disabled={start.isPending}>Iniciar</Button>
          </Card>
        ))
      )}
    </div>
  )
}

function formatElapsed(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function SessaoTreino({ sessao }: { sessao: SessaoAtiva }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [elapsed, setElapsed] = useState(0)
  const ses = useQuery({ queryKey: ['aluno-sessao-exs'], queryFn: alunoApi.sessaoExercicios, retry: false })
  const finish = useMutation({
    mutationFn: () => alunoApi.finish(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-sessao'] })
      qc.invalidateQueries({ queryKey: ['aluno-sessao-exs'] })
      qc.invalidateQueries({ queryKey: ['aluno-sessoes'] })
    },
  })
  const cancel = useMutation({
    mutationFn: () => alunoApi.cancel(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-sessao'] })
      qc.invalidateQueries({ queryKey: ['aluno-sessao-exs'] })
    },
  })

  useEffect(() => {
    const inicio = new Date(sessao.data_hora_inicio).getTime()
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - inicio) / 1000)))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [sessao.data_hora_inicio])

  if (ses.isLoading || !ses.data) return <Spinner />
  const exs = ses.data.exercicios
  const feitos = exs.filter((e) => e.registrado?.length).length
  const progresso = exs.length ? Math.round((feitos / exs.length) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display font-semibold">{ses.data.treino_nome}</p>
        <span className="flex items-center gap-1 text-sm font-mono text-energy">
          <Timer size={14} />{formatElapsed(elapsed)}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{feitos}/{exs.length} exercícios feitos</span>
      </div>
      <div className="h-2 rounded-full bg-surface-elevated border border-border overflow-hidden">
        <div
          className="h-full bg-energy transition-all duration-300"
          style={{ width: `${progresso}%` }}
          role="progressbar"
          aria-valuenow={progresso}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="text-xs text-text-muted">Toque em um exercício para registrar — você pode começar por onde quiser e editar depois.</p>
      {exs.map((ex) => <ExercicioCard key={ex.exercicio_id} ex={ex} />)}
      <Button
        variant="energy"
        className="w-full"
        disabled={finish.isPending}
        onClick={async () => {
          const pendentes = exs.filter((e) => !e.registrado?.length)
          const ok = await confirm({
            title: 'Finalizar treino?',
            message: pendentes.length > 0 ? (
              <div className="space-y-2">
                <p>
                  {pendentes.length} exercício{pendentes.length > 1 ? 's' : ''} ainda não
                  {pendentes.length > 1 ? ' foram executados' : ' foi executado'}:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-text-muted">
                  {pendentes.map((e) => <li key={e.exercicio_id}>{e.nome}</li>)}
                </ul>
                <p>Deseja finalizar mesmo assim?</p>
              </div>
            ) : 'Confirma a finalização do treino?',
            confirmLabel: 'Finalizar',
            cancelLabel: 'Continuar treinando',
          })
          if (ok) finish.mutate()
        }}
      >
        {finish.isPending ? 'Finalizando…' : 'Finalizar treino'}
      </Button>
      <Button
        variant="outline" className="w-full" disabled={cancel.isPending}
        onClick={async () => {
          const ok = await confirm({
            title: 'Cancelar treino',
            message: 'Cancelar este treino? Nada do que você fez nessa sessão será registrado.',
            confirmLabel: 'Cancelar treino', cancelLabel: 'Voltar', tone: 'danger',
          })
          if (ok) cancel.mutate()
        }}
      >
        {cancel.isPending ? 'Cancelando…' : 'Cancelar treino'}
      </Button>
    </div>
  )
}

function ExercicioCard({ ex }: { ex: ExSessao }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [pr, setPr] = useState<number | null>(null)
  const feito = !!ex.registrado?.length

  const initRows = () => {
    if (ex.registrado?.length) {
      return ex.registrado.map((s) => ({ carga: s.carga ?? '', reps: s.reps != null ? String(s.reps) : '', repsHint: '' }))
    }
    if (ex.series_prescritas?.length) {
      return ex.series_prescritas.flatMap((p) =>
        Array.from({ length: p.series }, () => ({ carga: p.carga ?? '', reps: '', repsHint: p.reps ? String(p.reps) : '' }))
      )
    }
    return Array.from({ length: ex.series ?? 1 }, () => ({ carga: ex.carga_prescrita ?? '', reps: '', repsHint: '' }))
  }
  const [rows, setRows] = useState(initRows)
  const upd = (i: number, f: 'carga' | 'reps', v: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [f]: v } : r)))
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i))

  const save = useMutation({
    mutationFn: () => {
      const series = rows
        .filter((r) => r.carga || r.reps)
        .map((r) => ({ carga: r.carga || undefined, reps: r.reps ? Number(r.reps) : undefined }))
      return alunoApi.registrar(series, ex.exercicio_id)
    },
    onSuccess: (r) => {
      if (r.pr_novo) setPr(r.pr_novo)
      qc.invalidateQueries({ queryKey: ['aluno-sessao-exs'] })
      qc.invalidateQueries({ queryKey: ['aluno-resumo'] })
      setOpen(false)
    },
  })

  return (
    <Card variant="elevated">
      <button className="w-full flex items-center justify-between text-left"
        onClick={() => { if (!open) { setRows(initRows()); setPr(null) } setOpen((o) => !o) }}>
        <span>
          <span className="font-medium">{ex.nome}</span>
          <span className="ml-2">
            {ex.series_prescritas?.length
              ? <SeriesPrescritasCompact items={ex.series_prescritas} />
              : <span className="text-xs text-text-muted">{ex.series ? `${ex.series}x` : ''}{ex.reps_prescritas ?? ''}{ex.carga_prescrita ? ` · ${ex.carga_prescrita}` : ''}</span>
            }
          </span>
        </span>
        {feito ? <Check size={16} className="text-success" /> : <ChevronRight size={16} className="text-text-muted" />}
      </button>

      {(ex.video_url || ex.observacoes) && (
        <div className="mt-2 space-y-1">
          {ex.video_url && (
            <a href={ex.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-hover hover:underline">
              <Video size={12} /> Ver vídeo de execução
            </a>
          )}
          {ex.observacoes && (
            <p className="text-xs text-text-secondary bg-white/5 rounded-lg px-2 py-1.5 whitespace-pre-wrap">{ex.observacoes}</p>
          )}
        </div>
      )}

      {feito && !open && (
        <p className="text-xs text-text-secondary mt-1">{ex.registrado!.map((s) => `${s.carga ?? '-'}×${s.reps ?? '-'}`).join('   ')}</p>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-xs text-text-muted w-12">Sér {i + 1}</span>
              <Input className="w-24" placeholder="Carga" value={r.carga} onChange={(e) => upd(i, 'carga', e.target.value)} />
              <Input className="w-20" placeholder={r.repsHint || 'Reps'} inputMode="numeric" value={r.reps} onChange={(e) => upd(i, 'reps', e.target.value)} />
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} aria-label="Remover série" className="text-text-muted hover:text-danger">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => setRows([...rows, { carga: '', reps: '', repsHint: '' }])} className="text-xs text-accent-hover">+ série</button>
          {pr != null && (
            <Badge tone="warning" className="text-xs">
              <Trophy size={12} /> Novo recorde: {pr} kg!
            </Badge>
          )}
          <Button variant="energy" className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : feito ? 'Atualizar' : 'Registrar'}
          </Button>

          <PostComposer exercicioId={ex.exercicio_id} exercicioNome={ex.nome} viewerAtor="ALUNO" />
        </div>
      )}
    </Card>
  )
}

function formatDuracao(secs?: number) {
  if (!secs) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  if (m > 0) return `${m}min ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

function groupSessoesByPeriodo(sessions: SessaoHistorico[]) {
  const groups: { label: string; items: typeof sessions }[] = []
  for (const s of sessions) {
    const d = new Date(s.data_hora_inicio)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    let label: string
    if (diffDays <= 6) label = 'Esta semana'
    else if (diffDays <= 13) label = 'Semana passada'
    else {
      const mes = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      label = mes.charAt(0).toUpperCase() + mes.slice(1)
    }
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(s)
    else groups.push({ label, items: [s] })
  }
  return groups
}

function HistoricoTab() {
  const { sessions, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAlunoTimeline()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (!sessions.length)
    return <EmptyState icon={<History />} title="Nenhum treino finalizado ainda" description="Complete seu primeiro treino para ver o histórico." />

  const groups = groupSessoesByPeriodo(sessions)

  return (
    <div className="space-y-4 pb-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{g.label}</p>
          <div className="space-y-2">
            {g.items.map((s) => {
              const expanded = expandedId === s.sessao_id
              const totalSeries = (s.exercicios_exec ?? []).reduce((acc, e) => acc + (e.series_exec?.length ?? 0), 0)
              return (
                <Card key={s.sessao_id} variant="elevated">
                  <button
                    className="w-full flex items-start justify-between text-left gap-2"
                    onClick={() => setExpandedId(expanded ? null : s.sessao_id)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.treino_nome}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {new Date(s.data_hora_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {s.duracao_segundos ? <> · <Clock size={10} className="inline mb-0.5" /> {formatDuracao(s.duracao_segundos)}</> : null}
                        {s.total_ex ? ` · ${s.total_ex} exercício${s.total_ex !== 1 ? 's' : ''}` : null}
                        {totalSeries ? ` · ${totalSeries} séries` : null}
                      </p>
                    </div>
                    {expanded ? <ChevronDown size={16} className="shrink-0 text-text-muted mt-0.5" /> : <ChevronRight size={16} className="shrink-0 text-text-muted mt-0.5" />}
                  </button>

                  {expanded && (
                    <AlunoSessaoDetalheCard sessaoId={s.sessao_id} />
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      ))}
      {hasNextPage && (
        <Button variant="outline" className="w-full" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? <Spinner /> : 'Carregar mais'}
        </Button>
      )}
    </div>
  )
}

type AbaEvolucao = 'carga' | 'volume' | 'recordes' | 'feed'

const ABA_EVOLUCAO: { key: AbaEvolucao; label: string; icon: React.ReactNode }[] = [
  { key: 'feed', label: 'Feed', icon: <MessageCircle size={13} /> },
  { key: 'carga', label: 'Carga', icon: <TrendingUp size={13} /> },
  { key: 'volume', label: 'Volume', icon: <BarChart3 size={13} /> },
  { key: 'recordes', label: 'Recordes', icon: <Trophy size={13} /> },
]

function Evolucao({ initialExId }: { initialExId?: string }) {
  const qc = useQueryClient()
  const { show } = useToast()
  const resumo = useQuery({ queryKey: ['aluno-resumo'], queryFn: alunoApi.resumo })
  const exs = useQuery({ queryKey: ['aluno-exs'], queryFn: alunoApi.listExercicios })
  const [exId, setExId] = useState(initialExId ?? '')
  const [aba, setAba] = useState<AbaEvolucao>('feed')
  const [prQuery, setPrQuery] = useState('')
  const [prLimit, setPrLimit] = useState(12)
  const exsOptions = useMemo(
    () => (exs.data ?? []).map((e) => ({ value: e.exercicio_id, label: e.nome })),
    [exs.data]
  )

  useEffect(() => {
    if (initialExId) { setExId(initialExId); setAba('feed'); return }
    if (!exId && exs.data?.length) setExId(exs.data[0].exercicio_id)
  }, [exs.data, exId, initialExId])

  const evo = useQuery({ queryKey: ['aluno-evo', exId], queryFn: () => alunoApi.evolucao(exId), enabled: !!exId && aba === 'carga' })
  const feed = useQuery({ queryKey: ['aluno-feed', exId], queryFn: () => alunoApi.feedExercicio(exId), enabled: !!exId && aba === 'feed' })

  const chartData = (evo.data?.serie ?? [])
    .filter((p) => p.carga_max != null)
    .map((p) => ({ data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), carga: p.carga_max }))

  const semanas = useMemo(
    () => (resumo.data?.semanas ?? []).map((w) => ({ semana: w.semana.replace(/^\d+-/, ''), volume: w.volume })),
    [resumo.data]
  )

  const prsFiltrados = useMemo(
    () => (resumo.data?.prs ?? []).filter((p) => p.exercicio.toLowerCase().includes(prQuery.toLowerCase())),
    [resumo.data, prQuery]
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Sessões" value={resumo.data?.total_sessoes ?? 0} tone="accent" />
        <StatCard label="Esta semana" value={resumo.data?.sessoes_semana ?? 0} tone="success" />
      </div>

      {/* Seletor de exercício */}
      {!!exs.data?.length && (
        <SearchableSelect
          options={exsOptions}
          value={exId}
          onChange={setExId}
          placeholder="Buscar exercício…"
        />
      )}

      {/* Abas */}
      <div className="flex gap-1 border-b border-border pb-0">
        {ABA_EVOLUCAO.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
              aba === a.key
                ? 'border-accent text-accent-hover bg-accent/5'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* Aba Carga */}
      {aba === 'carga' && (
        !exs.data?.length ? (
          <p className="text-text-muted text-sm">Sem exercícios ainda.</p>
        ) : !chartData.length ? (
          <p className="text-text-muted text-sm">Sem registros com carga ainda.</p>
        ) : (
          <Card variant="elevated">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-text-secondary">Carga por sessão</span>
              <Badge tone="warning"><Trophy size={12} /> {evo.data?.pr?.carga ?? '—'} kg</Badge>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="alunoCargaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-energy)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-energy)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="data" tick={axisTick} stroke="var(--color-border-strong)" />
                <YAxis tick={axisTick} stroke="var(--color-border-strong)" />
                <Tooltip contentStyle={chartTip} />
                <Area type="monotone" dataKey="carga" stroke="var(--color-energy)" strokeWidth={2.5}
                  fill="url(#alunoCargaGradient)" dot={{ r: 3, fill: 'var(--color-energy)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )
      )}

      {/* Aba Volume */}
      {aba === 'volume' && (
        !semanas.length ? (
          <p className="text-text-muted text-sm">Sem dados de volume ainda.</p>
        ) : (
          <Card variant="elevated">
            <p className="text-sm text-text-secondary mb-3">Volume por semana (kg)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={semanas} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="semana" tick={axisTick} stroke="var(--color-border-strong)" />
                <YAxis tick={axisTick} stroke="var(--color-border-strong)" />
                <Tooltip contentStyle={chartTip} />
                <Bar dataKey="volume" fill="var(--color-accent)" radius={[6, 6, 0, 0]} name="Volume (kg)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )
      )}

      {/* Aba Recordes */}
      {aba === 'recordes' && (
        !(resumo.data?.prs?.length) ? (
          <p className="text-text-muted text-sm">Nenhum recorde ainda.</p>
        ) : (
          <Card variant="elevated">
            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <Input placeholder="Buscar exercício…" value={prQuery} onChange={(e) => setPrQuery(e.target.value)} className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-2">
              {prsFiltrados.slice(0, prLimit).map((p) => (
                <Badge key={p.exercicio} tone="warning">{p.exercicio}: <b className="ml-1">{p.carga} kg</b></Badge>
              ))}
            </div>
            {prsFiltrados.length > prLimit && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPrLimit((n) => n + 12)}>
                Carregar mais ({prsFiltrados.length - prLimit} restantes)
              </Button>
            )}
          </Card>
        )
      )}

      {/* Aba Feed */}
      {aba === 'feed' && (
        !exs.data?.length ? (
          <p className="text-text-muted text-sm">Sem exercícios ainda.</p>
        ) : (
          <div className="space-y-3">
            {!!exId && (
              <PostComposer
                exercicioId={exId}
                exercicioNome={exs.data?.find((e) => e.exercicio_id === exId)?.nome}
                viewerAtor="ALUNO"
              />
            )}
            <ExercicioFeedCard
              items={feed.data ?? []}
              emptyText="Nenhuma postagem ainda. Use o botão acima para postar."
              viewerAtor="ALUNO"
              uploadMidia={async (file) => {
                const { upload_url, s3_key } = await alunoApi.midiaUploadUrl(file.name, file.type)
                await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
                return { s3_key, tipo: file.type.startsWith('video') ? 'video_execucao' : 'foto_exercicio' }
              }}
              onAddComentario={async (relatoSk, texto, midias, postTipo) => {
                try {
                  if (relatoSk.startsWith('POST#')) {
                    await alunoApi.comentarPost({ post_sk: relatoSk, texto, midias, post_tipo: postTipo })
                  } else {
                    await alunoApi.comentarRelato({ relato_sk: relatoSk, texto, midias })
                  }
                  qc.invalidateQueries({ queryKey: ['aluno-feed', exId] })
                } catch {
                  show('Não foi possível enviar o comentário.', 'error')
                }
              }}
            />
          </div>
        )
      )}
    </div>
  )
}
