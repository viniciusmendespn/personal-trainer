import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, TrendingUp, MessageCircle, Trophy, Check, ChevronRight, Video, X, Paperclip, AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { alunoApi, anexarMidiaExecucao, type ExSessao } from '../api/alunoApp'
import { ALUNO_TOKEN_KEY } from '../api/alunoClient'
import { useAlunoChat, useSendAlunoChat, useSendDiretoAlunoChat } from '../hooks/useAlunoChat'
import { ChatThread } from '../components/chat/ChatThread'
import { ChatInputBar } from '../components/chat/ChatInputBar'
import { MediaTimeline } from '../components/media/MediaTimeline'
import { Button, Card, Spinner, Input, Textarea, Select, Badge, StatCard, EmptyState, useToast, useConfirm } from '../components/ui'

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

export function AlunoApp() {
  const token = useAlunoToken()
  const [tab, setTab] = useState<'hoje' | 'evolucao' | 'chat'>('hoje')
  const me = useQuery({ queryKey: ['aluno-me'], queryFn: alunoApi.me, enabled: !!token, retry: false })

  if (!token) return <Centered>Abra o aplicativo pelo link enviado no seu WhatsApp.</Centered>
  if (me.isError) return <Centered>Seu link expirou. Peça um novo ao seu personal no WhatsApp.</Centered>

  return (
    <div
      className="min-h-screen max-w-md mx-auto flex flex-col"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <header className="p-4 shrink-0">
        <h1 className="font-display text-lg font-bold text-text">Olá, {me.data?.nome ?? 'aluno'} 👋</h1>
      </header>
      {tab === 'chat' ? (
        <ChatTab />
      ) : (
        <main className="px-4 flex-1">{tab === 'hoje' ? <Hoje /> : <Evolucao />}</main>
      )}
      <nav
        className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-surface-elevated/80 backdrop-blur-xl border-t border-border flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {([
          ['hoje', 'Treino', <Dumbbell size={18} />],
          ['evolucao', 'Evolução', <TrendingUp size={18} />],
          ['chat', 'Chat', <MessageCircle size={18} />],
        ] as const).map(
          ([k, label, icon]) => (
            <button key={k} onClick={() => setTab(k)}
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
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 4rem - 4.5rem - env(safe-area-inset-bottom))' }}
    >
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
  if (sessao.data?.sessao_id) return <SessaoTreino />

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

function SessaoTreino() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const ses = useQuery({ queryKey: ['aluno-sessao-exs'], queryFn: alunoApi.sessaoExercicios, retry: false })
  const finish = useMutation({
    mutationFn: () => alunoApi.finish(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-sessao'] })
      qc.invalidateQueries({ queryKey: ['aluno-sessao-exs'] })
    },
  })
  const cancel = useMutation({
    mutationFn: () => alunoApi.cancel(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-sessao'] })
      qc.invalidateQueries({ queryKey: ['aluno-sessao-exs'] })
    },
  })

  if (ses.isLoading || !ses.data) return <Spinner />
  const exs = ses.data.exercicios
  const feitos = exs.filter((e) => e.registrado?.length).length
  const progresso = exs.length ? Math.round((feitos / exs.length) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display font-semibold">{ses.data.treino_nome}</p>
        <span className="text-xs text-text-muted">{feitos}/{exs.length} feitos</span>
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
      <Button variant="energy" className="w-full" onClick={() => finish.mutate()} disabled={finish.isPending}>
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
  const { show } = useToast()
  const [open, setOpen] = useState(false)
  const [pr, setPr] = useState<number | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [relatoOpen, setRelatoOpen] = useState(false)
  const [relatoTipo, setRelatoTipo] = useState<'dor' | 'duvida'>('dor')
  const [relatoTexto, setRelatoTexto] = useState('')
  const feito = !!ex.registrado?.length

  async function onAnexarMidia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAttaching(true)
    try {
      await anexarMidiaExecucao(file, ex.exercicio_id, ex.nome)
      show('Enviado! Seu personal vai ver.', 'success')
    } catch {
      show('Não foi possível enviar a mídia.', 'error')
    } finally {
      setAttaching(false)
    }
  }

  const relato = useMutation({
    mutationFn: () => alunoApi.relato(relatoTipo, relatoTexto, ex.exercicio_id, ex.nome),
    onSuccess: () => {
      show('Seu personal foi avisado.', 'success')
      setRelatoOpen(false)
      setRelatoTexto('')
    },
  })

  const initRows = () => {
    const src = ex.registrado?.length
      ? ex.registrado
      : Array.from({ length: ex.series ?? 1 }, () => ({ carga: ex.carga_prescrita, reps: undefined }))
    return src.map((s) => ({ carga: s.carga ?? '', reps: s.reps != null ? String(s.reps) : '' }))
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
          <span className="text-xs text-text-muted ml-2">
            {ex.series ? `${ex.series}x` : ''}{ex.reps_prescritas ?? ''} {ex.carga_prescrita ? `· ${ex.carga_prescrita}` : ''}
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
              <Input className="w-20" placeholder="Reps" inputMode="numeric" value={r.reps} onChange={(e) => upd(i, 'reps', e.target.value)} />
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} aria-label="Remover série" className="text-text-muted hover:text-danger">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => setRows([...rows, { carga: ex.carga_prescrita ?? '', reps: '' }])} className="text-xs text-accent-hover">+ série</button>
          {pr != null && (
            <Badge tone="warning" className="text-xs">
              <Trophy size={12} /> Novo recorde: {pr} kg!
            </Badge>
          )}
          <Button variant="energy" className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : feito ? 'Atualizar' : 'Registrar'}
          </Button>

          <div className="flex items-center gap-3 pt-1">
            <label className="inline-flex items-center gap-1 text-xs text-text-secondary cursor-pointer">
              <Paperclip size={13} /> {attaching ? 'Enviando…' : 'Anexar vídeo/foto'}
              <input type="file" accept="image/*,video/*" className="hidden" disabled={attaching} onChange={onAnexarMidia} />
            </label>
            <button type="button" onClick={() => setRelatoOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs text-warning">
              <AlertTriangle size={13} /> Dor ou dúvida
            </button>
          </div>

          {relatoOpen && (
            <div className="space-y-2 bg-white/5 rounded-lg p-2.5">
              <Select value={relatoTipo} onChange={(e) => setRelatoTipo(e.target.value as 'dor' | 'duvida')}>
                <option value="dor">Dor / desconforto</option>
                <option value="duvida">Dúvida sobre o exercício</option>
              </Select>
              <Textarea
                rows={2} placeholder={relatoTipo === 'dor' ? 'Onde sentiu? Como foi?' : 'Qual sua dúvida?'}
                value={relatoTexto} onChange={(e) => setRelatoTexto(e.target.value)}
              />
              <Button
                size="sm" variant={relatoTipo === 'dor' ? 'danger' : 'outline'} className="w-full"
                disabled={!relatoTexto.trim() || relato.isPending}
                onClick={() => relato.mutate()}
              >
                {relato.isPending ? 'Enviando…' : 'Avisar personal'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function Evolucao() {
  const resumo = useQuery({ queryKey: ['aluno-resumo'], queryFn: alunoApi.resumo })
  const exs = useQuery({ queryKey: ['aluno-exs'], queryFn: alunoApi.listExercicios })
  const [exId, setExId] = useState('')
  useEffect(() => { if (!exId && exs.data?.length) setExId(exs.data[0].exercicio_id) }, [exs.data, exId])
  const evo = useQuery({ queryKey: ['aluno-evo', exId], queryFn: () => alunoApi.evolucao(exId), enabled: !!exId })
  const midias = useQuery({ queryKey: ['aluno-midia', exId], queryFn: () => alunoApi.listMidia(exId), enabled: !!exId })

  const data = (evo.data?.serie ?? [])
    .filter((p) => p.carga_max != null)
    .map((p) => ({ data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), carga: p.carga_max }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Sessões" value={resumo.data?.total_sessoes ?? 0} tone="accent" />
        <StatCard label="Esta semana" value={resumo.data?.sessoes_semana ?? 0} tone="success" />
      </div>
      {!exs.data?.length ? (
        <p className="text-text-muted text-sm">Sem exercícios ainda.</p>
      ) : (
        <>
          <select value={exId} onChange={(e) => setExId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text text-sm focus:outline-none focus:border-accent">
            {exs.data.map((ex) => <option key={ex.exercicio_id} value={ex.exercicio_id}>{ex.nome}</option>)}
          </select>
          {!data.length ? (
            <p className="text-text-muted text-sm">Sem registros com carga ainda.</p>
          ) : (
            <Card variant="elevated">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-text-secondary">Carga por sessão</span>
                <Badge tone="warning"><Trophy size={12} /> {evo.data?.pr?.carga ?? '—'} kg</Badge>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
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
          )}
          <MediaTimeline items={(midias.data ?? []).map((m) => ({ ...m, ator: m.ator ?? 'ALUNO' }))} isLoading={midias.isLoading} />
        </>
      )}
    </div>
  )
}
