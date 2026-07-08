import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Wrench } from 'lucide-react'
import { treinosApi } from '../../api/treinos'
import { alunoApi } from '../../api/alunoApp'
import { alunosApi } from '../../api/alunos'
import { personalApi } from '../../api/personal'
import { MediaTimeline, type MediaTimelineItem } from '../media/MediaTimeline'
import { ExercicioFeedCard } from '../exercicio/ExercicioFeedCard'
import { PostComposer } from '../exercicio/PostComposer'
import { Modal, Badge } from '../ui'
import { normalizeTipoExercicio, type TipoExercicio, type BlocoTreino } from '../../types'
import { fmtScoreWod } from '../../utils/wod'
import { formatoBlocoLabel, sufixoPrescricaoBloco } from '../exercicios/BlocosTreinoEditor'
import type { ScoreBlocoOut } from '../../api/alunoApp'

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
  tipo_exercicio?: string   // 'FORCA' | 'PERFORMANCE' (+ legados na leitura)
  bloco_id?: string | null
  aquecimento?: boolean
  unidade_carga?: string
  unidade_reps?: string
  series_exec: Array<{ carga?: string; reps?: number; rpe?: number; aquecimento?: boolean; contexto?: boolean }>
  series_prescritas?: Array<{ series: number; reps: string; carga?: string; aquecimento?: boolean }>
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
  bloco?: BlocoTreino  // bloco a que o exercício pertencia (rótulos Rd N / "por round")
}

function totalVolume(exs: ExecEx[]) {
  let v = 0
  for (const ex of exs) {
    if (ex.tipo_exercicio && ex.tipo_exercicio !== 'FORCA') continue
    if (ex.aquecimento) continue
    for (const s of ex.series_exec) {
      if (s.aquecimento) continue
      const cg = parseFloat(String(s.carga ?? '').replace(',', '.'))
      if (!isNaN(cg) && s.reps) v += cg * s.reps
    }
  }
  return v > 0 ? `${Math.round(v)} kg` : null
}

function prescritoLabel(ex: ExecEx, bloco?: BlocoTreino): string | null {
  if (ex.series_prescritas?.length) {
    // Bloco pontuável ou circuito com rounds: prescrição é POR round/minuto (igual à sessão)
    const pontuavel = !!bloco && bloco.formato !== 'LIVRE' && !bloco.aquecimento
    const sufixo = sufixoPrescricaoBloco(bloco)
    if (pontuavel || sufixo) {
      const base = ex.series_prescritas.map((s) => `${s.reps}${s.carga ? ` · ${s.carga}` : ''}`).join(' + ')
      return sufixo ? `${base} ${sufixo}` : base
    }
    return ex.series_prescritas.map((s) => `${s.series}×${s.reps}${s.carga ? ` · ${s.carga}` : ''}`).join(' + ')
  }
  if (ex.series || ex.reps_prescritas) {
    const p = [ex.series ? `${ex.series}x` : '', ex.reps_prescritas ?? ''].join('').trim()
    return [p, ex.carga_prescrita].filter(Boolean).join(' · ') || null
  }
  return null
}

function execLabel(tipo: TipoExercicio, s: { carga?: string; reps?: number; contexto?: boolean }, unidadeCarga?: string | null, unidadeReps?: string | null): string {
  // `||` cobre null/undefined/'' — default params só cobrem undefined, e o backend grava null
  // p/ FORÇA (kg/reps implícitos), o que renderizava a unidade literal "null".
  const uc = unidadeCarga || 'kg'
  const ur = unidadeReps || 'reps'
  // Anotação dentro de bloco de WOD (contexto): só a carga usada — o resultado é o score do bloco
  if (s.contexto || (s.reps == null && s.carga)) {
    return s.carga ? `Carga usada: ${s.carga} ${unidadeCarga || 'kg'}` : '—'
  }
  if (tipo === 'PERFORMANCE') {
    // 2ª medida (spec CROSSFIT §3.6): carga registrada em PERFORMANCE é contexto (ex.: min, kcal)
    const extra = s.carga ? ` · ${s.carga} ${unidadeCarga || ''}`.trimEnd() : ''
    return s.reps != null ? `${s.reps} ${ur}`.trimEnd() + extra : '—'
  }
  return `${s.reps != null ? `${s.reps} ${ur}` : '—'}${s.carga ? ` · ${s.carga} ${uc}` : ''}`
}

function ExercicioDetalhe({ ex, alunoId, bloco }: ExercicioDetalheProps) {
  const tipo = normalizeTipoExercicio(ex.tipo_exercicio)
  const prescrito = prescritoLabel(ex, bloco)
  // Circuito (LIVRE/aquecimento com rounds): cada série executada é um round → "Rd N"
  const circuito = !!bloco && bloco.formato === 'LIVRE' && (bloco.params?.rounds ?? 0) > 1
  const [correcaoOpen, setCorrecaoOpen] = useState(false)
  const { data: aluno } = useQuery({ queryKey: ['aluno', alunoId], queryFn: () => alunosApi.get(alunoId!), enabled: !!alunoId })
  const { data: myProfile } = useQuery({ queryKey: ['personal-profile'], queryFn: personalApi.getProfile, enabled: !!alunoId })
  const midiaItems: MediaTimelineItem[] = (ex.midia ?? []).map((m) => ({
    midia_id: m.midia_id,
    tipo: m.tipo,
    url: m.url,
    data_hora: m.data_hora,
    ator: m.ator,
  }))
  const relatos = (ex.relatos ?? []).map((r) => ({ ...r, tipo: r.tipo as 'DOR' | 'DUVIDA' | 'CORRECAO' }))

  return (
    <div className={`space-y-2 pb-3 border-b border-border last:border-0 last:pb-0 ${ex.aquecimento ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-text">
          {ex.exercicio_nome}
          {ex.aquecimento && <span className="ml-1.5 text-[10px] font-normal text-warning align-middle">aquecimento</span>}
        </p>
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
            <div key={i} className={`flex items-center gap-3 pl-2 text-xs ${s.aquecimento ? 'opacity-70' : ''}`}>
              <span className="text-text-muted w-12 shrink-0">{circuito ? `Rd ${i + 1}` : `Sér ${i + 1}`}</span>
              <span className="text-text">
                {execLabel(tipo, s, ex.unidade_carga, ex.unidade_reps)}
              </span>
              {s.aquecimento && <span className="text-[10px] text-warning">aq.</span>}
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
        <ExercicioFeedCard
          items={relatos}
          alunoNome={aluno?.nome}
          alunoFotoUrl={aluno?.foto_url}
          personalNome={myProfile?.nome}
          personalFotoUrl={myProfile?.foto_url}
        />
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

function SessaoDetalheConteudo({ data, alunoId }: { data: { duracao_segundos?: number; exercicios_exec?: ExecEx[]; scores_blocos?: ScoreBlocoOut[]; blocos?: BlocoTreino[] }; alunoId?: string }) {
  const exs = data.exercicios_exec ?? []
  const vol = totalVolume(exs)
  const scores = data.scores_blocos ?? []
  // Agrupa por bloco (mesma estrutura da tela de execução); sessões antigas sem blocos → lista plana
  const blocos = (data.blocos ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const blocoIds = new Set(blocos.map((b) => b.id))
  const semBloco = exs.filter((e) => !e.bloco_id || !blocoIds.has(e.bloco_id))

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

      {scores.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {scores.map((sc, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-energy/10 border border-energy/30 px-2 py-1 text-xs">
              <span className="text-text-secondary">{sc.bloco_nome || sc.nome}</span>
              <b className="text-text">{fmtScoreWod(sc)}</b>
              <span className={sc.rx ? 'text-energy font-medium' : 'text-text-muted'}>{sc.rx ? 'RX' : 'Adaptado'}</span>
              {sc.pr_novo && <span className="text-warning font-medium">PR!</span>}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {blocos.length === 0 && exs.map((ex) => (
          <ExercicioDetalhe key={ex.exercicio_id} ex={ex} alunoId={alunoId} />
        ))}
        {blocos.length > 0 && (
          <>
            {blocos.map((b) => {
              const doBloco = exs.filter((e) => e.bloco_id === b.id)
              if (!doBloco.length) return null
              const label = formatoBlocoLabel(b)
              return (
                <div key={b.id} className={b.aquecimento ? 'opacity-80' : ''}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-text-secondary">{b.nome}</span>
                    {label && <Badge tone={b.aquecimento ? 'neutral' : 'accent'}>{label}</Badge>}
                  </div>
                  <div className="space-y-3 pl-1">
                    {doBloco.map((ex) => (
                      <ExercicioDetalhe key={ex.exercicio_id} ex={ex} alunoId={alunoId} bloco={b} />
                    ))}
                  </div>
                </div>
              )
            })}
            {semBloco.length > 0 && (
              <div>
                <div className="mb-2"><span className="text-xs font-semibold text-text-secondary">Outros</span></div>
                <div className="space-y-3 pl-1">
                  {semBloco.map((ex) => (
                    <ExercicioDetalhe key={ex.exercicio_id} ex={ex} alunoId={alunoId} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
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
