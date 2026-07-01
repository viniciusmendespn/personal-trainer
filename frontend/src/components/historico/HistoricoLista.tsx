import { useState, type ReactNode } from 'react'
import { History, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, Spinner, EmptyState, Button } from '../ui'
import { CheckinUploadButton } from '../aluno/CheckinUploadButton'

/** Campos mínimos que a lista usa — atende tanto SessaoHistorico (aluno) quanto
 * SessaoHistoricoPersonal (portal). `tem_checkin` só existe na listagem do aluno. */
export interface SessaoLista {
  sessao_id: string
  treino_nome: string
  data_hora_inicio: string
  duracao_segundos?: number
  total_ex?: number
  exercicios_exec?: Array<{ series_exec?: unknown[] }>
  tem_checkin?: boolean
}

export function formatDuracao(s?: number): string | null {
  if (!s) return null
  const m = Math.floor(s / 60)
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}min`
  if (m > 0) return `${m}min`
  return `${s}s`
}

function groupSessoesByPeriodo<T extends SessaoLista>(sessions: T[]) {
  const groups: { label: string; items: T[] }[] = []
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

interface TimelineResult<T> {
  sessions: T[]
  isLoading: boolean
  fetchNextPage: () => void
  hasNextPage?: boolean
  isFetchingNextPage: boolean
}

/** Histórico de sessões em lista, agrupado por período e com detalhe expansível.
 * Compartilhado entre app do aluno e portal do personal — parametrizado por `useTimeline`
 * (fonte paginada) e `renderDetalhe` (card do aluno x card do portal), no mesmo espírito
 * do `CalendarioMes`. `permitirCheckin` habilita o envio da foto de check-in depois. */
export function HistoricoLista<T extends SessaoLista>({
  useTimeline,
  renderDetalhe,
  permitirCheckin = false,
}: {
  useTimeline: () => TimelineResult<T>
  renderDetalhe: (sessaoId: string) => ReactNode
  permitirCheckin?: boolean
}) {
  const { sessions, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTimeline()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (!sessions.length)
    return <EmptyState icon={<History />} title="Nenhum treino finalizado ainda" description="Treinos finalizados aparecem aqui no histórico." />

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

                  {permitirCheckin && !s.tem_checkin && (
                    <div className="mt-2">
                      <CheckinUploadButton sessaoId={s.sessao_id} variant="outline" className="w-full text-sm" />
                    </div>
                  )}

                  {expanded && renderDetalhe(s.sessao_id)}
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
