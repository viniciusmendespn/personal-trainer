import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users, Bell, MessageCircle, ArrowRight, Calendar, Cake,
  BookOpen, LayoutTemplate, Target, Zap, CalendarCheck,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import { useDashboard } from '../hooks/useDashboard'
import { useAlunos } from '../hooks/useAlunos'
import { useBiblioteca } from '../hooks/useDominio'
import { useTemplates } from '../hooks/useTemplates'
import { wapiApi } from '../api/wapi'
import { Card, StatCard, SkeletonCard, EmptyState, Avatar, Badge } from '../components/ui'
import { tempoRelativo } from '../utils/datetime'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: '#e2e8f0',
  fontSize: 12,
}
const chartTipItem = { color: '#e2e8f0' }
const chartTipLabel = { color: '#94a3b8' }
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 11 }

const PIE_COLORS = [
  'var(--color-accent)',
  'var(--color-energy)',
  'var(--color-success)',
  'var(--color-warning)',
  '#a78bfa',
  '#f472b6',
  '#34d399',
  '#60a5fa',
]

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
function startOfWeek(d: Date) {
  const date = new Date(d)
  const diff = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date
}
function fmtDia(iso: string) { return iso.split('-')[2] }
function fmtEvento(iso: string) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${hh}:${mm} · ${dd}/${mo}`
}

function DeltaChip({ curr, prev, unit = '' }: { curr: number; prev: number; unit?: string }) {
  const d = curr - prev
  if (d === 0 || prev === 0) return null
  const up = d > 0
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${up ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
      {up ? '↑' : '↓'}{Math.abs(d)}{unit}
    </span>
  )
}

const STATUS_EVENTO: Record<string, { label: string; tone: 'success' | 'accent' | 'neutral' | 'warning' }> = {
  AGENDADO: { label: 'Agendado', tone: 'accent' },
  CONFIRMADO: { label: 'Confirmado', tone: 'success' },
  CANCELADO: { label: 'Cancelado', tone: 'neutral' },
  CONCLUIDO: { label: 'Concluído', tone: 'neutral' },
}

export function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const status = useQuery({ queryKey: ['wapi-status'], queryFn: wapiApi.status, retry: false })
  const { data: alunos } = useAlunos()
  const { data: biblioteca } = useBiblioteca()
  const { data: templates } = useTemplates()

  const hoje = useMemo(() => ymd(new Date()), [])
  const semanaInicio = useMemo(() => ymd(startOfWeek(new Date())), [])
  const semanaFim = useMemo(() => {
    const d = startOfWeek(new Date())
    d.setDate(d.getDate() + 6)
    return ymd(d)
  }, [])
  const semanaAntInicio = useMemo(() => {
    const d = startOfWeek(new Date())
    d.setDate(d.getDate() - 7)
    return ymd(d)
  }, [])
  const semanaAntFim = useMemo(() => {
    const d = startOfWeek(new Date())
    d.setDate(d.getDate() - 1)
    return ymd(d)
  }, [])
  const mesAtual = useMemo(() => new Date().getMonth(), [])

  const sessoesHoje = useMemo(
    () => (data?.sessoes_por_dia ?? []).find((d) => d.data === hoje)?.total ?? 0,
    [data, hoje],
  )
  const sessoesSemana = useMemo(
    () => (data?.sessoes_por_dia ?? [])
      .filter((d) => d.data >= semanaInicio && d.data <= semanaFim)
      .reduce((acc, d) => acc + d.total, 0),
    [data, semanaInicio, semanaFim],
  )
  const sessoesSemanaAnt = useMemo(
    () => (data?.sessoes_por_dia ?? [])
      .filter((d) => d.data >= semanaAntInicio && d.data <= semanaAntFim)
      .reduce((acc, d) => acc + d.total, 0),
    [data, semanaAntInicio, semanaAntFim],
  )

  const aderenciaAtual = useMemo(() => {
    if (!data?.aderencia_7d || !data.alunos_ativos) return null
    return Math.round((data.aderencia_7d.alunos_unicos / data.alunos_ativos) * 100)
  }, [data])
  const aderenciaPrev = useMemo(() => {
    if (!data?.aderencia_7d || !data.alunos_ativos) return null
    return Math.round((data.aderencia_7d.alunos_unicos_prev / data.alunos_ativos) * 100)
  }, [data])

  const pctApp = useMemo(() => {
    if (data?.alunos_app == null || !data.alunos_ativos) return null
    return Math.round((data.alunos_app / data.alunos_ativos) * 100)
  }, [data])

  const alunosById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const a of alunos ?? []) m[a.aluno_id] = a.nome
    return m
  }, [alunos])

  const aniversariantes = useMemo(
    () => (alunos ?? []).filter((a) => {
      if (!a.data_nascimento) return false
      return new Date(a.data_nascimento + 'T12:00:00').getMonth() === mesAtual
    }),
    [alunos, mesAtual],
  )

  const chartData = (data?.sessoes_por_dia ?? []).map((d) => ({
    ...d,
    label: fmtDia(d.data),
  }))
  const maxSessoes = Math.max(...chartData.map((d) => d.total), 1)

  const pieData = useMemo(
    () => Object.entries(data?.dist_objetivos ?? {})
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    [data?.dist_objetivos],
  )

  const bibliotecaCount = biblioteca?.length ?? 0
  const templatesCount = templates?.length ?? 0

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h2 className="font-display text-xl font-semibold">Visão geral</h2>

      {status.data && !status.data.connected && (
        <Card variant="elevated" className="border-warning/30 bg-warning/10">
          <div className="flex items-center gap-2 text-warning text-sm">
            <MessageCircle size={18} />
            <span>
              Seu WhatsApp não está conectado.{' '}
              <Link to="/config?tab=whatsapp" className="underline font-medium">Conectar agora</Link> para ativar o assistente.
            </span>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !data?.alunos ? (
        <EmptyState
          icon={<Users />}
          title="Nenhum aluno cadastrado ainda"
          description="Comece criando seu primeiro aluno para acompanhar treinos e evolução."
          action={
            <Link to="/alunos" className="text-accent-hover text-sm font-medium hover:underline inline-flex items-center gap-1">
              Cadastrar aluno <ArrowRight size={14} />
            </Link>
          }
        />
      ) : (
        <>
          {/* ── Row 1: KPIs principais ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Card composto: Alunos / Ativos */}
            <Link to="/alunos" className="block">
              <Card variant="elevated" className="flex items-start gap-3 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all h-full">
                <div className="p-2 rounded-lg bg-accent/15 text-accent-hover [&>svg]:w-5 [&>svg]:h-5 shrink-0">
                  <Users />
                </div>
                <div className="flex gap-4 min-w-0">
                  <div>
                    <p className="text-xs text-text-secondary">Total</p>
                    <p className="font-display text-2xl font-bold text-text">{data.alunos}</p>
                  </div>
                  <div className="w-px self-stretch bg-border" />
                  <div>
                    <p className="text-xs text-text-secondary">Ativos</p>
                    <p className="font-display text-2xl font-bold text-success">{data.alunos_ativos}</p>
                  </div>
                </div>
              </Card>
            </Link>

            {/* Card composto: Sessões hoje / semana */}
            <Card variant="elevated" className="flex items-start gap-3 h-full">
              <div className="p-2 rounded-lg bg-energy/15 text-energy [&>svg]:w-5 [&>svg]:h-5 shrink-0">
                <CalendarCheck />
              </div>
              <div className="flex gap-4 min-w-0">
                <div>
                  <p className="text-xs text-text-secondary">Hoje</p>
                  <p className="font-display text-2xl font-bold text-text">{sessoesHoje}</p>
                </div>
                <div className="w-px self-stretch bg-border" />
                <div className="min-w-0">
                  <p className="text-xs text-text-secondary flex items-center gap-1">
                    Semana <DeltaChip curr={sessoesSemana} prev={sessoesSemanaAnt} />
                  </p>
                  <p className="font-display text-2xl font-bold text-text">{sessoesSemana}</p>
                </div>
              </div>
            </Card>

            {/* Notificações */}
            <StatCard
              icon={<Bell />}
              label="Notificações"
              value={data.notificacoes_nao_lidas ?? 0}
              tone="danger"
              to="/notificacoes"
            />
          </div>

          {/* ── Row 2: Métricas + atalhos ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Aderência 7d */}
            <Card variant="elevated" className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent/15 text-accent-hover [&>svg]:w-5 [&>svg]:h-5 shrink-0">
                <Target />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-text-secondary flex items-center gap-1">
                  Aderência 7d
                  {aderenciaAtual != null && aderenciaPrev != null && (
                    <DeltaChip curr={aderenciaAtual} prev={aderenciaPrev} unit="%" />
                  )}
                </p>
                <p className="font-display text-2xl font-bold text-text mt-0.5">
                  {aderenciaAtual != null ? `${aderenciaAtual}%` : '—'}
                </p>
                {data.aderencia_7d && (
                  <p className="text-[11px] text-text-muted">
                    {data.aderencia_7d.alunos_unicos} de {data.alunos_ativos} alunos
                  </p>
                )}
              </div>
            </Card>

            {/* % no app */}
            <Card variant="elevated" className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-success/15 text-success [&>svg]:w-5 [&>svg]:h-5 shrink-0">
                <Zap />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-text-secondary">Usam o App</p>
                <p className="font-display text-2xl font-bold text-text mt-0.5">
                  {data.alunos_app ?? 0}
                  {pctApp != null && <span className="text-base font-normal text-text-secondary ml-1">({pctApp}%)</span>}
                </p>
                <p className="text-[11px] text-text-muted">de {data.alunos_ativos} ativos</p>
              </div>
            </Card>

            {/* Atalhos: Biblioteca + Templates */}
            <div className="grid grid-cols-2 gap-3 col-span-2 sm:col-span-1">
              <Link to="/biblioteca" className="block">
                <Card variant="elevated" className="flex flex-col items-center justify-center gap-1.5 py-3 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all text-center h-full">
                  <BookOpen size={18} className="text-accent-hover" />
                  <p className="text-xs font-medium text-text-secondary leading-tight">Biblioteca</p>
                  {bibliotecaCount > 0 && <p className="text-xs text-text-muted">{bibliotecaCount} itens</p>}
                </Card>
              </Link>
              <Link to="/templates" className="block">
                <Card variant="elevated" className="flex flex-col items-center justify-center gap-1.5 py-3 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all text-center h-full">
                  <LayoutTemplate size={18} className="text-energy" />
                  <p className="text-xs font-medium text-text-secondary leading-tight">Templates</p>
                  {templatesCount > 0 && <p className="text-xs text-text-muted">{templatesCount} itens</p>}
                </Card>
              </Link>
            </div>
          </div>

          {/* ── Row 3: Gráficos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar chart 14d */}
            <Card variant="elevated" className="flex flex-col">
              <p className="text-xs font-medium text-text-secondary mb-3">Sessões realizadas — últimos 14 dias</p>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} barSize={16} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={1} />
                    <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={chartTip}
                      itemStyle={chartTipItem}
                      labelStyle={chartTipLabel}
                      formatter={(v: number) => [v, 'sessões']}
                      labelFormatter={(l) => `Dia ${l}`}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.total > 0 ? 'var(--color-accent)' : 'rgba(255,255,255,0.06)'}
                          opacity={entry.total > 0 ? (0.4 + (entry.total / maxSessoes) * 0.6) : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-text-muted py-8">
                  Nenhuma sessão nos últimos 14 dias
                </div>
              )}
            </Card>

            {/* Pie chart: distribuição por objetivo */}
            <Card variant="elevated" className="flex flex-col">
              <p className="text-xs font-medium text-text-secondary mb-3">Distribuição por objetivo</p>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, color: 'var(--color-text-secondary)' }}
                    />
                    <Tooltip
                      contentStyle={chartTip}
                      itemStyle={chartTipItem}
                      formatter={(v: number, name: string) => [v, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-text-muted py-8">
                  Nenhum objetivo cadastrado nos alunos
                </div>
              )}
            </Card>
          </div>

          {/* ── Row 4: Próximos eventos + Atividade recente ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Próximos eventos da agenda */}
            <Card variant="elevated">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                  <Calendar size={13} /> Próximos eventos (7 dias)
                </p>
                <Link to="/agenda" className="text-xs text-accent-hover hover:underline flex items-center gap-0.5">
                  Ver agenda <ArrowRight size={11} />
                </Link>
              </div>
              {data.proximos_eventos && data.proximos_eventos.length > 0 ? (
                <div className="space-y-2.5">
                  {data.proximos_eventos.map((ev) => {
                    const s = STATUS_EVENTO[ev.status] ?? { label: ev.status, tone: 'neutral' as const }
                    const nomeAluno = alunosById[ev.aluno_id] ?? ev.aluno_id
                    return (
                      <div key={ev.agendamento_id} className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              to={`/alunos/${ev.aluno_id}`}
                              className="text-sm font-medium truncate hover:underline hover:text-accent"
                            >
                              {nomeAluno}
                            </Link>
                            <Badge tone={s.tone}>{s.label}</Badge>
                          </div>
                          <p className="text-xs text-text-muted">{fmtEvento(ev.data_hora_inicio)} · {ev.duracao_min}min</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center text-xs text-text-muted py-4">
                  Nenhum evento nos próximos 7 dias
                </div>
              )}
            </Card>

            {/* Atividade recente */}
            <Card variant="elevated">
              <p className="text-xs font-medium text-text-secondary mb-3">Atividade recente</p>
              {data.atividade_recente && data.atividade_recente.length > 0 ? (
                <div className="space-y-3">
                  {data.atividade_recente.map((a) => (
                    <div key={a.aluno_id} className="flex items-center gap-3">
                      <Avatar name={a.aluno_nome} imageUrl={a.foto_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/alunos/${a.aluno_id}`}
                            className="text-sm font-medium truncate hover:underline hover:text-accent"
                          >
                            {a.aluno_nome}
                          </Link>
                          <Badge tone={a.status === 'EM_ANDAMENTO' ? 'success' : 'neutral'}>
                            {a.status === 'EM_ANDAMENTO' ? 'Treinando agora' : 'Concluído'}
                          </Badge>
                        </div>
                        <p className="text-xs text-text-muted truncate">
                          {a.treino_nome}
                          {a.status === 'EM_ANDAMENTO' && a.exercicio_atual && (
                            <> — {a.exercicio_atual} ({(a.ordem_atual ?? 0) + 1}/{a.total_ex})</>
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-text-muted shrink-0">{tempoRelativo(a.atualizado_em)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center text-xs text-text-muted py-4">
                  Nenhuma atividade recente
                </div>
              )}
            </Card>
          </div>

          {/* ── Row 5: Aniversariantes do mês ── */}
          {aniversariantes.length > 0 && (
            <Card variant="elevated">
              <p className="text-xs font-medium text-text-secondary mb-3 flex items-center gap-1.5">
                <Cake size={14} /> Aniversariantes do mês ({aniversariantes.length})
              </p>
              <div className="flex flex-wrap gap-3">
                {aniversariantes.map((a) => (
                  <Link key={a.aluno_id} to={`/alunos/${a.aluno_id}`} className="flex items-center gap-2 hover:opacity-80">
                    <Avatar name={a.nome} imageUrl={a.foto_url} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{a.nome}</p>
                      {a.data_nascimento && (
                        <p className="text-xs text-text-muted">
                          {a.data_nascimento.slice(8, 10)}/{a.data_nascimento.slice(5, 7)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
