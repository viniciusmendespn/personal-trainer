import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Pencil, Repeat, X as XIcon } from 'lucide-react'
import { SubstitutoPicker } from './SubstitutoPicker'
import { SeriesPrescritasEditor, SeriesPrescritasCompact } from './SeriesPrescritasEditor'
import type { ExercicioSubstituto, ExLib, SeriePrescrita } from '../../types'

interface Props {
  exercicioNome: string
  biblioteca: ExLib[]
  seriesPrescritasOriginal: SeriePrescrita[]
  substitutos: ExercicioSubstituto[]
  onChangeSubstitutos: (v: ExercicioSubstituto[]) => void
  excluidos: string[]
  onChangeExcluidos: (v: string[]) => void
}

export function SubstitutosTreinoEditor({
  exercicioNome, biblioteca, seriesPrescritasOriginal,
  substitutos, onChangeSubstitutos, excluidos, onChangeExcluidos,
}: Props) {
  const [expandido, setExpandido] = useState<string | null>(null)
  const libEntry = biblioteca.find((b) => b.nome.trim().toLowerCase() === exercicioNome.trim().toLowerCase())
  const libSubs = libEntry?.substitutos ?? []
  const excluidosSet = new Set(excluidos.map((e) => e.toLowerCase()))
  const treinoNomes = new Set(substitutos.map((s) => s.nome.toLowerCase()))

  const herdados = libSubs
    .filter((s) => !excluidosSet.has(s.nome.toLowerCase()) && !treinoNomes.has(s.nome.toLowerCase()))
    .map((s) => ({ ...s, origem: 'biblioteca' as const }))
  const proprios = substitutos.map((s) => ({ ...s, origem: 'treino' as const }))
  const efetivos = [...herdados, ...proprios]

  function remove(item: ExercicioSubstituto & { origem: 'biblioteca' | 'treino' }) {
    if (item.origem === 'biblioteca') {
      onChangeExcluidos([...excluidos, item.nome.toLowerCase()])
    } else {
      onChangeSubstitutos(substitutos.filter((s) => s.nome !== item.nome))
    }
  }

  function add(item: ExercicioSubstituto) {
    onChangeSubstitutos([...substitutos, { ...item, series_prescritas: seriesPrescritasOriginal }])
  }

  function updateSeries(item: ExercicioSubstituto, novaSerie: SeriePrescrita[]) {
    const nomeLower = item.nome.toLowerCase()
    const existe = substitutos.some((s) => s.nome.toLowerCase() === nomeLower)
    if (existe) {
      onChangeSubstitutos(substitutos.map((s) => (s.nome.toLowerCase() === nomeLower ? { ...s, series_prescritas: novaSerie } : s)))
    } else {
      onChangeSubstitutos([
        ...substitutos,
        { nome: item.nome, video_url: item.video_url, observacao: item.observacao, series_prescritas: novaSerie },
      ])
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-secondary flex items-center gap-1">
        <Repeat size={14} /> Exercícios substitutos
      </p>
      {efetivos.length > 0 && (
        <div className="space-y-1">
          {efetivos.map((s) => {
            const seriesAtual = s.series_prescritas?.length ? s.series_prescritas : seriesPrescritasOriginal
            const aberto = expandido === s.nome
            return (
              <div key={s.nome} className="rounded-lg hover:bg-surface-elevated transition-colors">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  {s.origem === 'biblioteca'
                    ? <BookOpen size={12} className="shrink-0 text-accent" />
                    : <Pencil size={12} className="shrink-0 text-text-muted" />}
                  <button
                    type="button"
                    onClick={() => setExpandido(aberto ? null : s.nome)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="text-xs truncate block" title={s.observacao}>
                      {s.nome}
                      {s.video_url && <a href={s.video_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent-hover ml-2 hover:underline">vídeo</a>}
                    </span>
                    {seriesAtual.length > 0 && <SeriesPrescritasCompact items={seriesAtual} />}
                  </button>
                  {aberto ? <ChevronDown size={14} className="shrink-0 text-text-muted" /> : <ChevronRight size={14} className="shrink-0 text-text-muted" />}
                  <button type="button" onClick={() => remove(s)} className="shrink-0 hover:text-danger">
                    <XIcon size={12} />
                  </button>
                </div>
                {aberto && (
                  <div className="px-2 pb-2">
                    <SeriesPrescritasEditor value={seriesAtual} onChange={(v) => updateSeries(s, v)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <SubstitutoPicker
        biblioteca={biblioteca}
        exercicioAtual={exercicioNome}
        jaAdicionados={efetivos.map((s) => s.nome.toLowerCase())}
        onAdd={add}
      />
    </div>
  )
}
