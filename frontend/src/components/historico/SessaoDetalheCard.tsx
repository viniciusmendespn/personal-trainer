import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { treinosApi } from '../../api/treinos'
import { alunoApi } from '../../api/alunoApp'
import { MediaTimeline, type MediaTimelineItem } from '../media/MediaTimeline'

function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  if (m > 0) return `${m}min ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

interface ExecEx {
  exercicio_id: string
  exercicio_nome: string
  series_exec: Array<{ carga?: string; reps?: number; rpe?: number }>
  series_prescritas?: Array<{ series: number; reps: string; carga?: string }>
  series?: number
  reps_prescritas?: string
  carga_prescrita?: string
  midia?: Array<{ midia_id: string; tipo: string; url?: string; data_hora: string; ator?: 'ALUNO' | 'PERSONAL' }>
}

function totalVolume(exs: ExecEx[]) {
  let v = 0
  for (const ex of exs) {
    for (const s of ex.series_exec) {
      const cg = parseFloat(String(s.carga ?? '').replace(',', '.'))
      if (!isNaN(cg) && s.reps) v += cg * s.reps
    }
  }
  return v > 0 ? `${Math.round(v)} kg` : null
}

function prescritoLabel(ex: ExecEx): string | null {
  if (ex.series_prescritas?.length) {
    return ex.series_prescritas.map((s) => `${s.series}×${s.reps}${s.carga ? ` · ${s.carga}` : ''}`).join(' + ')
  }
  if (ex.series || ex.reps_prescritas) {
    const p = [ex.series ? `${ex.series}x` : '', ex.reps_prescritas ?? ''].join('').trim()
    return [p, ex.carga_prescrita].filter(Boolean).join(' · ') || null
  }
  return null
}

function ExercicioDetalhe({ ex }: { ex: ExecEx }) {
  const prescrito = prescritoLabel(ex)
  const midiaItems: MediaTimelineItem[] = (ex.midia ?? []).map((m) => ({
    midia_id: m.midia_id,
    tipo: m.tipo,
    url: m.url,
    data_hora: m.data_hora,
    ator: m.ator,
  }))

  return (
    <div className="space-y-2 pb-3 border-b border-border last:border-0 last:pb-0">
      <p className="text-sm font-semibold text-text">{ex.exercicio_nome}</p>

      {prescrito && (
        <div className="flex gap-2 text-xs">
          <span className="text-text-muted w-20 shrink-0">Prescrito</span>
          <span className="text-text-secondary">{prescrito}</span>
        </div>
      )}

      {ex.series_exec.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs text-text-muted font-medium">Executado</p>
          {ex.series_exec.map((s, i) => (
            <div key={i} className="flex items-center gap-3 pl-2 text-xs">
              <span className="text-text-muted w-12 shrink-0">Sér {i + 1}</span>
              <span className="text-text">
                {s.carga ?? '—'}{s.reps ? ` × ${s.reps} reps` : ''}
              </span>
              {s.rpe != null && (
                <span className="text-text-muted">RPE {s.rpe}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {midiaItems.length > 0 && (
        <MediaTimeline items={midiaItems} compact />
      )}
    </div>
  )
}

function SessaoDetalheConteudo({ data }: { data: { duracao_segundos?: number; exercicios_exec?: ExecEx[] } }) {
  const exs = data.exercicios_exec ?? []
  const vol = totalVolume(exs)

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-1">
      {(data.duracao_segundos || vol || exs.length > 0) && (
        <div className="flex flex-wrap gap-3 text-xs text-text-muted mb-3">
          {data.duracao_segundos && (
            <span className="flex items-center gap-1"><Clock size={11} /> {fmtDur(data.duracao_segundos)}</span>
          )}
          {vol && <span>Volume: {vol}</span>}
          {exs.length > 0 && <span>{exs.length} exercício{exs.length !== 1 ? 's' : ''}</span>}
        </div>
      )}

      <div className="space-y-3">
        {exs.map((ex) => (
          <ExercicioDetalhe key={ex.exercicio_id} ex={ex} />
        ))}
        {exs.length === 0 && (
          <p className="text-xs text-text-muted">Nenhum exercício registrado.</p>
        )}
      </div>
    </div>
  )
}

/** Versão para o personal (usa endpoint /v1/alunos/{alunoId}/sessoes/{sessaoId}) */
export function SessaoDetalheCard({ alunoId, sessaoId }: { alunoId: string; sessaoId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sessao-detalhe', alunoId, sessaoId],
    queryFn: () => treinosApi.sessaoDetalhe(alunoId, sessaoId),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <Skeleton />
  if (isError || !data) return <p className="text-xs text-text-muted py-2 mt-3 border-t border-border pt-3">Não foi possível carregar os detalhes.</p>
  return <SessaoDetalheConteudo data={data} />
}

/** Versão para o app do aluno (usa endpoint /v1/aluno/sessoes/{sessaoId}) */
export function AlunoSessaoDetalheCard({ sessaoId }: { sessaoId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['aluno-sessao-detalhe', sessaoId],
    queryFn: () => alunoApi.sessaoDetalhe(sessaoId),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <Skeleton />
  if (isError || !data) return <p className="text-xs text-text-muted py-2 mt-3 border-t border-border pt-3">Não foi possível carregar os detalhes.</p>
  return <SessaoDetalheConteudo data={data} />
}

function Skeleton() {
  return (
    <div className="mt-3 border-t border-border pt-3 space-y-2 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-3 bg-white/5 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
      ))}
    </div>
  )
}
