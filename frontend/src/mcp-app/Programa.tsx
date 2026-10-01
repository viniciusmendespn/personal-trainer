import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, Dumbbell, Repeat, StickyNote, Video } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { formatValue } from './presentation'
import { diaLocal, fmtDate } from './ui'
import type { Exercicio, Programa, Treino } from './types'

export function ProgramaView({ programa }: { programa: Programa }) {
  if (!programa.treinos.length) return <EmptyState icon={<Dumbbell />} title="Sem programa atual." description="Este aluno ainda não tem treinos cadastrados." />
  return <div className="space-y-3">{programa.treinos.map((t, i) => <TreinoCard key={t.origem_id || i} treino={t} />)}</div>
}

function vencido(t: Treino) {
  return !!t.data_fim && t.data_fim < diaLocal(new Date())
}

function TreinoCard({ treino }: { treino: Treino }) {
  const [open, setOpen] = useState(true)
  const expired = vencido(treino)
  const meta = [treino.foco, [treino.data_inicio && `de ${fmtDate(treino.data_inicio)}`, treino.data_fim && `até ${fmtDate(treino.data_fim)}`].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
  return <Card variant="elevated" className={expired || !treino.ativo ? 'opacity-80' : ''}>
    <div className="flex items-center justify-between gap-2">
      <button type="button" className="flex-1 min-w-0 flex items-center gap-2 text-left" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        {open ? <ChevronDown size={16} className="shrink-0 text-text-muted" /> : <ChevronRight size={16} className="shrink-0 text-text-muted" />}
        <span className="min-w-0">
          <span className="font-medium block truncate">{treino.nome}</span>
          {meta && <span className="text-xs text-text-muted block truncate">{meta}</span>}
        </span>
      </button>
      {!treino.ativo ? <Badge>Inativo</Badge> : expired ? <Badge tone="danger">Vencido</Badge> : null}
      <span className="text-xs text-text-muted shrink-0">{treino.exercicios.length} exerc.</span>
    </div>
    {open && <div className="mt-3 pl-2 sm:pl-6">
      {treino.observacoes && <p className="text-xs text-text-secondary mb-2 flex items-start gap-1.5"><StickyNote size={12} className="text-warning shrink-0 mt-0.5" />{treino.observacoes}</p>}
      {treino.blocos.map((b, n) => <div key={n} className="flex items-center gap-2 mt-2 mb-1">
        <span className="text-xs font-semibold text-text-secondary">{String(b.nome || `Bloco ${n + 1}`)}</span>
        {!!b.formato && <Badge tone="accent">{String(b.formato)}</Badge>}
        <span className="text-xs text-text-muted truncate">{formatValue(Object.fromEntries(Object.entries(b).filter(([k]) => !['nome', 'formato', 'bloco_id', 'id'].includes(k))))}</span>
      </div>)}
      {treino.exercicios.length
        ? treino.exercicios.map((e, n) => <ExercicioRow key={e.origem_id || n} ex={e} index={n + 1} />)
        : <p className="text-xs text-text-muted">Sem exercícios neste treino.</p>}
    </div>}
  </Card>
}

export function prescricao(e: Exercicio) {
  const unidadeReps = e.unidade_reps || (e.tipo_exercicio === 'FORCA' ? 'reps' : '')
  return e.series_prescritas?.map(s => `${s.series} × ${s.reps}${unidadeReps ? ` ${unidadeReps}` : ''}${s.carga ? ` · ${s.carga} ${e.unidade_carga || 'kg'}` : ''}${s.aquecimento ? ' (aprox.)' : ''}`) ?? []
}

function ExercicioRow({ ex, index }: { ex: Exercicio; index: number }) {
  const [subs, setSubs] = useState(false)
  const grupos = ex.grupos?.length ? ex.grupos : ex.grupo ? [ex.grupo] : []
  const linhas = prescricao(ex)
  return <div className="border-b border-border last:border-b-0 py-2">
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-mono text-text-muted w-4 text-center select-none pt-1">{index}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap text-sm">
          <span className="font-medium">{ex.nome}</span>
          {ex.aquecimento && <Badge>aq.</Badge>}
          {ex.bloco_id && <Badge tone="accent">bloco {ex.bloco_id}</Badge>}
        </div>
        <div className="text-xs text-text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          {linhas.length ? linhas.map((l, i) => <span key={i} className="text-text-secondary">{l}</span>) : <span>Prescrição pelo bloco</span>}
          {!!grupos.length && <span>{grupos.join(', ')}</span>}
          {ex.intervalo_s ? <span className="inline-flex items-center gap-0.5" title="Intervalo de descanso"><Clock size={11} />{ex.intervalo_s}s</span> : null}
          {ex.video_url && /^https?:\/\//.test(ex.video_url) && <a href={ex.video_url} target="_blank" rel="noreferrer" aria-label={`Vídeo de ${ex.nome}`} className="inline-flex items-center gap-0.5 text-accent-hover hover:underline"><Video size={12} />vídeo</a>}
          {!!ex.substitutos.length && <button type="button" onClick={() => setSubs(v => !v)} aria-expanded={subs} className="inline-flex items-center gap-0.5 hover:text-text"><Repeat size={11} />{ex.substitutos.length} substituto{ex.substitutos.length > 1 ? 's' : ''}</button>}
        </div>
        {ex.observacoes && <p className="text-xs text-warning mt-1 flex items-start gap-1"><StickyNote size={11} className="shrink-0 mt-0.5" />{ex.observacoes}</p>}
        {subs && <ul className="mt-1.5 space-y-1 border-l-2 border-border pl-2">{ex.substitutos.map((s, i) => <li key={i} className="text-xs text-text-secondary">
          <span className="font-medium text-text">{s.nome}</span>{s.observacao ? ` — ${s.observacao}` : ''}
          {s.video_url && /^https?:\/\//.test(s.video_url) && <> <a href={s.video_url} target="_blank" rel="noreferrer" className="text-accent-hover hover:underline">vídeo</a></>}
        </li>)}</ul>}
      </div>
    </div>
  </div>
}
