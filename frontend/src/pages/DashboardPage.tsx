import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users, UserCheck, Bell, Clock, MessageCircle, ArrowRight, Calendar, CalendarCheck, Cake, LayoutTemplate } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useAgenda } from '../hooks/useAgenda'
import { useAlunos } from '../hooks/useAlunos'
import { useTemplates } from '../hooks/useTemplates'
import { wapiApi } from '../api/wapi'
import { Card, StatCard, SkeletonCard, EmptyState } from '../components/ui'

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
function startOfWeek(d: Date) {
  const date = new Date(d)
  const diff = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date
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

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="font-display text-xl font-semibold mb-6">Visão geral</h2>

      {status.data && !status.data.connected && (
        <Card variant="elevated" className="mb-6 border-warning/30 bg-warning/10">
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <StatCard icon={<Users />} label="Alunos" value={data?.alunos ?? 0} tone="accent" />
            <StatCard icon={<UserCheck />} label="Ativos" value={data?.alunos_ativos ?? 0} tone="success" />
            <StatCard icon={<Bell />} label="Notificações" value={data?.notificacoes_nao_lidas ?? 0} tone="danger" />
            <StatCard icon={<Clock />} label="Pendências" value={data?.pendencias ?? 0} tone="warning" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={<Calendar />} label="Sessões hoje" value={sessoesHoje} tone="accent" />
            <StatCard icon={<CalendarCheck />} label="Sessões na semana" value={sessoesSemana} tone="energy" />
            <StatCard icon={<CalendarCheck />} label="Aderência semana" value={`${aderencia}%`} tone="success" />
            <StatCard icon={<Cake />} label="Aniversariantes" value={aniversariantes} tone="warning" />
          </div>
          <div className="mt-3">
            <StatCard icon={<LayoutTemplate />} label="Templates" value={templates?.length ?? 0} tone="accent" />
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-4">
        <Link to="/alunos" className="text-accent-hover text-sm hover:underline">→ Gerenciar alunos</Link>
        <Link to="/notificacoes" className="text-accent-hover text-sm hover:underline">→ Ver notificações</Link>
      </div>
    </div>
  )
}
