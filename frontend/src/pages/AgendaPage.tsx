import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronLeft, ChevronRight, Calendar, Check, X, Trash2, Pencil, Dumbbell, CalendarDays } from 'lucide-react'
import { useAlunos } from '../hooks/useAlunos'
import { useAgenda, useCreateAgendamento, useUpdateAgendamento, useSetAgendamentoStatus, useDeleteAgendamento } from '../hooks/useAgenda'
import { Button, Card, Input, Select, Modal, Badge, EmptyState, Spinner, useConfirm } from '../components/ui'
import type { Agendamento, AgendamentoCreate, AgendamentoStatus } from '../types'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function startOfWeek(d: Date) {
  const date = new Date(d)
  const diff = (date.getDay() + 6) % 7 // segunda = 0
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date
}
function addDays(d: Date, n: number) {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
}

const statusTone: Record<AgendamentoStatus, 'accent' | 'success' | 'danger' | 'neutral'> = {
  AGENDADO: 'accent',
  CONFIRMADO: 'success',
  CANCELADO: 'danger',
  CONCLUIDO: 'neutral',
}

function getStatusEfetivo(a: Agendamento): AgendamentoStatus {
  if (
    (a.status === 'AGENDADO' || a.status === 'CONFIRMADO') &&
    new Date(a.data_hora_inicio) < new Date()
  ) {
    return 'CONCLUIDO'
  }
  return a.status
}

export function AgendaPage() {
  const [view, setView] = useState<'semana' | 'mes'>('semana')
  const [anchor, setAnchor] = useState(() => new Date())
  const [open, setOpen] = useState(false)
  const { data: alunos } = useAlunos()

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const monthStart = useMemo(() => startOfMonth(anchor), [anchor])
  const monthEnd = useMemo(() => endOfMonth(anchor), [anchor])

  const rangeStart = view === 'semana' ? weekStart : monthStart
  const rangeEnd = view === 'semana' ? weekEnd : monthEnd
  const { data: agendamentos, isLoading } = useAgenda(
    rangeStart.toISOString(),
    new Date(rangeEnd.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
  )

  const porDia = useMemo(() => {
    const map: Record<string, Agendamento[]> = {}
    for (const a of agendamentos ?? []) {
      const k = a.data_hora_inicio.slice(0, 10)
      ;(map[k] ||= []).push(a)
    }
    return map
  }, [agendamentos])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Calendar size={20} className="text-accent-hover" /> Agenda
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setView('semana')} className={`px-3 py-1.5 text-sm ${view === 'semana' ? 'bg-accent/20 text-accent-hover' : 'text-text-secondary'}`}>Semana</button>
            <button onClick={() => setView('mes')} className={`px-3 py-1.5 text-sm ${view === 'mes' ? 'bg-accent/20 text-accent-hover' : 'text-text-secondary'}`}>Mês</button>
          </div>
          <Button onClick={() => setOpen(true)}><span className="flex items-center gap-1"><Plus size={16} /> Novo</span></Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" iconOnly aria-label="Anterior" onClick={() => setAnchor((d) => addDays(d, view === 'semana' ? -7 : -30))}>
          <ChevronLeft size={18} />
        </Button>
        <p className="text-sm text-text-secondary font-medium">
          {view === 'semana'
            ? `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
            : anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
        <Button variant="ghost" size="sm" iconOnly aria-label="Próximo" onClick={() => setAnchor((d) => addDays(d, view === 'semana' ? 7 : 30))}>
          <ChevronRight size={18} />
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo agendamento">
        <AgendamentoForm alunos={alunos ?? []} onDone={() => setOpen(false)} defaultDate={new Date()} />
      </Modal>

      {isLoading ? (
        <Spinner />
      ) : view === 'semana' ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => {
            const day = addDays(weekStart, i)
            const key = ymd(day)
            const items = (porDia[key] ?? []).sort((a, b) => a.data_hora_inicio.localeCompare(b.data_hora_inicio))
            return (
              <Card key={key} variant="elevated">
                <p className="text-sm font-medium mb-2">
                  {DIAS_SEMANA[day.getDay()]} <span className="text-text-muted">· {day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                </p>
                {!items.length ? (
                  <p className="text-xs text-text-muted">Sem compromissos.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((a) => <AgendamentoRow key={a.agendamento_id} a={a} alunoNome={alunos?.find((x) => x.aluno_id === a.aluno_id)?.nome} />)}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        <MonthGrid monthStart={monthStart} porDia={porDia} onPickDay={(d) => { setAnchor(d); setView('semana') }} />
      )}
    </div>
  )
}

function AgendamentoRow({ a, alunoNome }: { a: Agendamento; alunoNome?: string }) {
  const setStatus = useSetAgendamentoStatus()
  const del = useDeleteAgendamento()
  const confirm = useConfirm()
  const [editOpen, setEditOpen] = useState(false)
  const hora = new Date(a.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const statusEfetivo = getStatusEfetivo(a)

  async function cancelar() {
    const ok = await confirm({
      title: 'Cancelar agendamento',
      message: `Cancelar o horário de ${alunoNome ?? 'este aluno'} às ${hora}?`,
      confirmLabel: 'Cancelar agendamento', cancelLabel: 'Voltar', tone: 'danger',
    })
    if (ok) setStatus.mutate({ a, status: 'CANCELADO' })
  }

  async function remove() {
    const ok = await confirm({
      title: 'Excluir agendamento',
      message: `Excluir o horário de ${alunoNome ?? 'este aluno'} às ${hora}?`,
      confirmLabel: 'Excluir', tone: 'danger',
    })
    if (ok) del.mutate(a)
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm border-b border-border last:border-0 pb-2 last:pb-0">
      <div className="min-w-0">
        <p className="truncate">
          <span className="font-medium">{hora}</span> ·{' '}
          <Link to={`/alunos/${a.aluno_id}`} className="text-accent-hover hover:underline inline-flex items-center gap-1">
            {alunoNome ?? a.aluno_id} <Dumbbell size={11} />
          </Link>
        </p>
        {a.observacao && <p className="text-xs text-text-muted truncate">{a.observacao}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge tone={statusTone[statusEfetivo]}>{statusEfetivo}</Badge>
        {statusEfetivo === 'AGENDADO' && (
          <Button variant="ghost" size="sm" iconOnly aria-label="Confirmar" onClick={() => setStatus.mutate({ a, status: 'CONFIRMADO' })}>
            <Check size={14} />
          </Button>
        )}
        {statusEfetivo === 'CANCELADO' && (
          <Button variant="ghost" size="sm" iconOnly aria-label="Reativar e confirmar" onClick={() => setStatus.mutate({ a, status: 'CONFIRMADO' })}>
            <Check size={14} />
          </Button>
        )}
        {(statusEfetivo === 'AGENDADO' || statusEfetivo === 'CONFIRMADO' ||
          (statusEfetivo === 'CONCLUIDO' && a.status !== 'CONCLUIDO')) && (
          <Button variant="ghost" size="sm" iconOnly aria-label="Cancelar" onClick={cancelar} className="hover:text-danger">
            <X size={14} />
          </Button>
        )}
        <Button variant="ghost" size="sm" iconOnly aria-label="Editar" onClick={() => setEditOpen(true)}>
          <Pencil size={14} />
        </Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Excluir" onClick={remove} className="hover:text-danger">
          <Trash2 size={14} />
        </Button>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar agendamento">
        <AgendamentoForm editing={a} onDone={() => setEditOpen(false)} />
      </Modal>
    </div>
  )
}

function MonthGrid({
  monthStart, porDia, onPickDay,
}: { monthStart: Date; porDia: Record<string, Agendamento[]>; onPickDay: (d: Date) => void }) {
  const gridStart = startOfWeek(monthStart)
  const days = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i))

  if (!Object.keys(porDia).length) {
    return <EmptyState icon={<CalendarDays />} title="Nenhum compromisso neste mês" />
  }

  return (
    <div className="grid grid-cols-7 gap-1.5 text-center">
      {DIAS_SEMANA.map((d) => <div key={d} className="text-[11px] text-text-muted py-1">{d.slice(0, 3)}</div>)}
      {days.map((day) => {
        const key = ymd(day)
        const count = porDia[key]?.length ?? 0
        const inMonth = day.getMonth() === monthStart.getMonth()
        return (
          <button
            key={key}
            onClick={() => onPickDay(day)}
            className={`aspect-square rounded-lg border text-xs flex flex-col items-center justify-center gap-0.5 transition-colors ${
              inMonth ? 'border-border hover:border-accent/50 text-text' : 'border-border/40 text-text-muted'
            }`}
          >
            {day.getDate()}
            {count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
          </button>
        )
      })}
    </div>
  )
}

function splitDateHora(iso: string): [string, string] {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  ]
}

function AgendamentoForm({
  alunos, onDone, defaultDate, editing,
}: { alunos?: { aluno_id: string; nome: string }[]; onDone: () => void; defaultDate?: Date; editing?: Agendamento }) {
  const { data: alunosLoaded } = useAlunos()
  const lista = alunos ?? alunosLoaded ?? []
  const create = useCreateAgendamento()
  const update = useUpdateAgendamento()
  const [eData, eHora] = editing ? splitDateHora(editing.data_hora_inicio) : ['', '']
  const [alunoId, setAlunoId] = useState(editing?.aluno_id ?? lista[0]?.aluno_id ?? '')
  const [data, setData] = useState(editing ? eData : ymd(defaultDate ?? new Date()))
  const [hora, setHora] = useState(editing ? eHora : '08:00')
  const [duracao, setDuracao] = useState(String(editing?.duracao_min ?? 60))
  const [observacao, setObservacao] = useState(editing?.observacao ?? '')
  const saving = create.isPending || update.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!alunoId || !data || !hora) return
    const body: AgendamentoCreate = {
      aluno_id: alunoId,
      data_hora_inicio: new Date(`${data}T${hora}:00`).toISOString(),
      duracao_min: Number(duracao) || 60,
      observacao: observacao || undefined,
    }
    if (editing) {
      await update.mutateAsync({ a: editing, body })
    } else {
      await create.mutateAsync(body)
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Select label="Aluno" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} required>
        {lista.map((a) => <option key={a.aluno_id} value={a.aluno_id}>{a.nome}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <Input label="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
      </div>
      <Input label="Duração (min)" type="number" min={15} step={15} value={duracao} onChange={(e) => setDuracao(e.target.value)} />
      <Input label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      <Button type="submit" className="w-full" disabled={saving || !lista.length}>
        {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Agendar'}
      </Button>
      {!lista.length && <p className="text-xs text-text-muted text-center">Cadastre um aluno primeiro.</p>}
    </form>
  )
}
