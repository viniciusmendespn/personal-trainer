import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users, UserCheck, Bell, MessageCircle, ArrowRight, Calendar, CalendarCheck, Cake, LayoutTemplate } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { useDashboard } from '../hooks/useDashboard'
import { useAgenda } from '../hooks/useAgenda'
import { useAlunos } from '../hooks/useAlunos'
import { useTemplates } from '../hooks/useTemplates'
import { wapiApi } from '../api/wapi'
import { Card, StatCard, SkeletonCard, EmptyState } from '../components/ui'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: 'var(--color-text)',
  fontSize: 12,
}
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 11 }

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
function startOfWeek(d: Date) {
  const date = new Date(d)
  const diff = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function fmtDia(iso: string) {
  const [, , d] = iso.split('-')
  return `${d}`
}

export function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const status = useQuery({ queryKey: ['wapi-status'], queryFn: wapiApi.status, retry: false })

  const hoje = useMemo(() => ymd(new Date()), [])
  const semanaInicio = useMemo(() => ymd(startOfWeek(new Date())), [])
  const semanaFim = useMemo(() => {
    const d = startOfWeek(new Date())
    d.setDate(d.getDate() + 6)
    return ymd(d)
  }, [])
  const mesAtual = useMemo(() => new Date().getMonth(), [])

  const { data: agendaHoje } = useAgenda(hoje, hoje)
  const { data: agendaSemana } = useAgenda(semanaInicio, semanaFim)
  const { data: alunos } = useAlunos()
  const { data: templates } = useTemplates()

  const sessoesHoje = agendaHoje?.length ?? 0
  const sessoesSemana = agendaSemana?.length ?? 0
  const concluidas = (agendaSemana ?? []).filter((a) => a.status === 'CONCLUIDO').length
  const aderencia = sessoesSemana > 0 ? Math.round((concluidas / sessoesSemana) * 100) : 0
  const aniversariantes = (alunos ?? []).filter((a) => {
    if (!a.data_nascimento) return false
    const m = new Date(a.data_nascimento + 'T12:00:00').getMonth()
    return m === mesAtual
  }).length

  const chartData = (data?.sessoes_por_dia ?? []).map((d) => ({
    ...d,
    label: fmtDia(d.data),
  }))
  const maxSessoes = Math.max(...(chartData.map((d) => d.total)), 1)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h2 className="font-display text-xl font-semibold">Visão geral</h2>

      {status.data && !status.data.connected && (
        <Card variant="elevated" className="border-warning/30 bg-warning/10">
          <div className="flex items-center gap-2 text-warning text-sm">
            <MessageCircle size={18} />
            <span>
              Seu WhatsApp não está conectado.{' '}
              <Link to="/config" className="underline font-medium">Conectar agora</Link> para ativar o assistente.
            </span>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
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
          {/* Linha principal: stats à esquerda + gráfico à direita */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Stats principais */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<Users />} label="Alunos" value={data?.alunos ?? 0} tone="accent" />
              <StatCard icon={<UserCheck />} label="Ativos" value={data?.alunos_ativos ?? 0} tone="success" />
              <StatCard icon={<Calendar />} label="Sessões hoje" value={sessoesHoje} tone="accent" />
              <StatCard icon={<CalendarCheck />} label={`Aderência (${aderencia}%)`} value={`${concluidas}/${sessoesSemana}`} tone={aderencia >= 70 ? 'success' : aderencia >= 40 ? 'warning' : 'danger'} />
            </div>

            {/* Gráfico de frequência de sessões */}
            <Card variant="elevated" className="flex flex-col">
              <p className="text-xs font-medium text-text-secondary mb-3">Sessões realizadas — últimos 14 dias</p>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={chartData} barSize={14} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={1} />
                    <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={chartTip}
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
                <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
                  Nenhuma sessão nos últimos 14 dias
                </div>
              )}
            </Card>
          </div>

          {/* Cards secundários em grid 2×2 simétrico */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<CalendarCheck />} label="Sessões na semana" value={sessoesSemana} tone="energy" />
            <StatCard icon={<Bell />} label="Notificações" value={data?.notificacoes_nao_lidas ?? 0} tone="danger" />
            <StatCard icon={<Cake />} label="Aniversariantes" value={aniversariantes} tone="warning" />
            <StatCard icon={<LayoutTemplate />} label="Templates" value={templates?.length ?? 0} tone="accent" />
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-4 pt-1">
        <Link to="/alunos" className="text-accent-hover text-sm hover:underline">→ Gerenciar alunos</Link>
        <Link to="/notificacoes" className="text-accent-hover text-sm hover:underline">→ Ver notificações</Link>
      </div>
    </div>
  )
}
