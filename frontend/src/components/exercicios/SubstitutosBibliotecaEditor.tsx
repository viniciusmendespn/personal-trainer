import { Repeat, X as XIcon } from 'lucide-react'
import { SubstitutoPicker } from './SubstitutoPicker'
import type { ExercicioSubstituto, ExLib } from '../../types'

interface Props {
  exercicioNome: string
  biblioteca: ExLib[]
  value: ExercicioSubstituto[]
  onChange: (v: ExercicioSubstituto[]) => void
}

export function SubstitutosBibliotecaEditor({ exercicioNome, biblioteca, value, onChange }: Props) {
  function remove(nome: string) {
    onChange(value.filter((s) => s.nome !== nome))
  }

  function add(item: ExercicioSubstituto) {
    onChange([...value, item])
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-secondary flex items-center gap-1">
        <Repeat size={14} /> Exercícios substitutos
      </p>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((s) => (
            <span
              key={s.nome}
              className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs px-2 py-1 rounded-full"
            >
              {s.nome}
              <button type="button" onClick={() => remove(s.nome)} className="hover:text-danger">
                <XIcon size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <SubstitutoPicker
        biblioteca={biblioteca}
        exercicioAtual={exercicioNome}
        jaAdicionados={value.map((s) => s.nome.toLowerCase())}
        onAdd={add}
      />
    </div>
  )
}
