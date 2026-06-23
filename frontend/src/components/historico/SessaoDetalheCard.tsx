import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Wrench } from 'lucide-react'
import { treinosApi } from '../../api/treinos'
import { alunoApi } from '../../api/alunoApp'
import { MediaTimeline, type MediaTimelineItem } from '../media/MediaTimeline'
import { ExercicioFeedCard } from '../exercicio/ExercicioFeedCard'
import { PostComposer } from '../exercicio/PostComposer'
import { Modal } from '../ui'

function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  if (m > 0) return `${m}min ${String(s).padStart(2, '0')}s`
  return `${s}s`
}


interface Relato {
  tipo: 'DOR' | 'DUVIDA'
  descricao: string
  data_hora: string
  respondido: boolean
  resposta_texto?: string
  respondido_em?: string
}

interface ExecEx {
  exercicio_id: string
  exercicio_nome: string
  tipo_exercicio?: 'FORCA' | 'CARDIO' | 'PESO_CORPORAL'
  unidade_carga?: string
  unidade_reps?: string
  series_exec: Array<{ carga?: string; reps?: number; rpe?: number }>
  series_prescritas?: Array<{ series: number; reps: string; carga?: string }>
  series?: number
  reps_prescritas?: string
  carga_prescrita?: string
  midia?: Array<{ midia_id: string; tipo: string; url?: string; data_hora: string; ator?: 'ALUNO' | 'PERSONAL' }>
  relatos?: Relato[]
  substituto_nome?: string
}

interface ExercicioDetalheProps {
  ex: ExecEx
  alunoId?: string  // presente só no lado do personal
}

function totalVolume(exs: ExecEx[]) {
  let v = 0
  for (const ex of exs) {
    if (ex.tipo_exercicio && ex.tipo_exercicio !== 'FORCA') continue
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

function execLabel(tipo: 'FORCA' | 'CARDIO' | 'PESO_CORPORAL', s: { carga?: string; reps?: number }, unidadeCarga = 'kg', unidadeReps = 'reps'): string {
  if (tipo === 'CARDIO') {
    const val = s.reps != null ? String(s.reps) : '—'
    return s.carga ? `${val} · RPE ${s.carga}` : val
  }
  if (tipo === 'PESO_CORPORAL') {
    return s.reps != null ? `${s.reps} ${unidadeReps}` : '—'
  }
  return `${s.carga ? `${s.carga} ${unidadeCarga}` : '—'}${s.reps ? ` × ${s.reps} ${unidadeReps}` : ''}`
}

function ExercicioDetalhe({ ex, alunoId }: ExercicioDetalheProps) {
  const tipo = ex.tipo_exercicio ?? 'FORCA'
  const prescrito = prescritoLabel(ex)
  const [correcaoOpen, setCorrecaoOpen] = useState(false)
  const midiaItems: MediaTimelineItem[] = (ex.midia ?? []).map((m) => ({
    midia_id: m.midia_id,
    tipo: m.tipo,
    url: m.url,
    data_hora: m.data_hora,
    ator: m.ator,
  }))
  const relatos = (ex.relatos ?? []).map((r) => ({ ...r, tipo: r.tipo as 'DOR' | 'DUVIDA' | 'CORRECAO' }))

  return (
    <div className="space-y-2 pb-3 border-b border-border last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-text">{ex.exercicio_nome}</p>
        {alunoId && (
          <button
            type="button"
            onClick={() => setCorrecaoOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-accent-hover transition-colors"
          >
            <Wrench size={12} /> Postar correção
          </button>
        )}
      </div>

      {ex.substituto_nome && (
        <p className="text-xs text-accent">↔ Substituído por: {ex.substituto_nome}</p>
      )}

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
                {execLabel(tipo, s, ex.unidade_carga, ex.unidade_reps)}
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

      {relatos.length > 0 && (
        <ExercicioFeedCard items={relatos} />
      )}

      {alunoId && (
        <Modal open={correcaoOpen} onClose={() => setCorrecaoOpen(false)} title={`Correção — ${ex.exercicio_nome}`}>
          <PostComposer
            exercicioId={ex.exercicio_id}
            exercicioNome={ex.exercicio_nome}
            viewerAtor="PERSONAL"
            alunoId={alunoId}
            onSuccess={() => setCorrecaoOpen(false)}
          />
        </Modal>
      )}
    </div>
  )
}

function SessaoDetalheConteudo({ data, alunoId }: { data: { duracao_segundos?: number; exercicios_exec?: ExecEx[] }; alunoId?: string }) {
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
          <ExercicioDetalhe key={ex.exercicio_id} ex={ex} alunoId={alunoId} />
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
  return <SessaoDetalheConteudo data={data} alunoId={alunoId} />
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
