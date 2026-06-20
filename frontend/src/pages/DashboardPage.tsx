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
import { Card, StatCard, SkeletonCard, EmptyState, Avatar, Badge } from '../components/ui'

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

function tempoRelativo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d}d`
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
  const aniversariantes = (alunos ?? []).filter((a) => {
    if (!a.data_nascimento) return false
    const m = new Date(a.data_nascimento + 'T12:00:00').getMonth()
    return m === mesAtual
  })

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
            {/* Stats principais — empilhado em telas estreitas/junto ao gráfico p/ não espremer o texto */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
              <StatCard icon={<Users />} label="Alunos" value={data?.alunos ?? 0} tone="accent" />
              <StatCard icon={<UserCheck />} label="Ativos" value={data?.alunos_ativos ?? 0} tone="success" />
              <StatCard icon={<Calendar />} label="Sessões hoje" value={sessoesHoje} tone="accent" />
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
                <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
                  Nenhuma sessão nos últimos 14 dias
                </div>
              )}
            </Card>
          </div>

          {/* Cards secundários — empilhados no mobile, 3 colunas a partir de sm (full width) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard icon={<CalendarCheck />} label="Sessões na semana" value={sessoesSemana} tone="energy" />
            <StatCard icon={<Bell />} label="Notificações" value={data?.notificacoes_nao_lidas ?? 0} tone="danger" />
            <StatCard icon={<LayoutTemplate />} label="Templates" value={templates?.length ?? 0} tone="accent" />
          </div>

          {/* Atividade recente: últimos alunos que treinaram / estão treinando */}
          <Card variant="elevated">
            <p className="text-xs font-medium text-text-secondary mb-3">Atividade recente</p>
            {data?.atividade_recente && data.atividade_recente.length > 0 ? (
              <div className="space-y-3">
                {data.atividade_recente.map((a) => (
                  <div key={a.aluno_id} className="flex items-center gap-3">
                    <Avatar name={a.aluno_nome} imageUrl={a.foto_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{a.aluno_nome}</span>
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

          {/* Aniversariantes do mês — lista de nomes, não cabe num StatCard */}
          {aniversariantes.length > 0 && (
            <Card variant="elevated">
              <p className="text-xs font-medium text-text-secondary mb-3 flex items-center gap-1.5">
                <Cake size={14} /> Aniversariantes do mês ({aniversariantes.length})
              </p>
              <div className="flex flex-wrap gap-3">
                {aniversariantes.map((a) => (
                  <div key={a.aluno_id} className="flex items-center gap-2">
                    <Avatar name={a.nome} imageUrl={a.foto_url} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{a.nome}</p>
                      {a.data_nascimento && (
                        <p className="text-xs text-text-muted">
                          {a.data_nascimento.slice(8, 10)}/{a.data_nascimento.slice(5, 7)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-4 pt-1">
        <Link to="/alunos" className="text-accent-hover text-sm hover:underline">→ Gerenciar alunos</Link>
        <Link to="/notificacoes" className="text-accent-hover text-sm hover:underline">→ Ver notificações</Link>
      </div>
    </div>
  )
}
