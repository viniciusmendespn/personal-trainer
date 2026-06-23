import { BookOpen, Pencil, Repeat, X as XIcon } from 'lucide-react'
import { SubstitutoPicker } from './SubstitutoPicker'
import type { ExercicioSubstituto, ExLib } from '../../types'

interface ExercicioOpcao {
  nome: string
  grupo?: string
  video_url?: string
}

interface Props {
  exercicioNome: string
  biblioteca: ExLib[]
  exerciciosDoTreino?: ExercicioOpcao[]
  substitutos: ExercicioSubstituto[]
  onChangeSubstitutos: (v: ExercicioSubstituto[]) => void
  excluidos: string[]
  onChangeExcluidos: (v: string[]) => void
}

export function SubstitutosTreinoEditor({
  exercicioNome, biblioteca, exerciciosDoTreino,
  substitutos, onChangeSubstitutos, excluidos, onChangeExcluidos,
}: Props) {
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
    onChangeSubstitutos([...substitutos, item])
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-secondary flex items-center gap-1">
        <Repeat size={14} /> Exercícios substitutos
      </p>
      {efetivos.length > 0 && (
        <div className="space-y-1">
          {efetivos.map((s) => (
            <div
              key={s.nome}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
            >
              {s.origem === 'biblioteca'
                ? <BookOpen size={12} className="shrink-0 text-accent" />
                : <Pencil size={12} className="shrink-0 text-text-muted" />}
              <span className="text-xs flex-1 truncate" title={s.observacao}>
                {s.nome}
                {s.video_url && <a href={s.video_url} target="_blank" rel="noreferrer" className="text-accent-hover ml-2 hover:underline">vídeo</a>}
              </span>
              <button type="button" onClick={() => remove(s)} className="shrink-0 hover:text-danger">
                <XIcon size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <SubstitutoPicker
        biblioteca={biblioteca}
        exerciciosDoTreino={exerciciosDoTreino}
        exercicioAtual={exercicioNome}
        jaAdicionados={efetivos.map((s) => s.nome.toLowerCase())}
        onAdd={add}
      />
    </div>
  )
}
