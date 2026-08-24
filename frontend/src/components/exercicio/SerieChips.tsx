import { fmtSerieExecutada, type SerieExecutada, type UnidadesExercicio } from '../../utils/serie'

interface Props extends UnidadesExercicio {
  series: SerieExecutada[]
  /** Anotação de carga dentro de bloco de WOD não é uma série — some por padrão. */
  filtrarContexto?: boolean
  /** Espaçamento entre os chips (o portal usa `gap-1`, o app do aluno `gap-1.5`). */
  className?: string
}

/** Séries executadas como chips ("12 reps · 60 kg"), usado nas duas "última vez". */
export function SerieChips({ series, filtrarContexto = true, className = 'gap-1.5', ...unidades }: Props) {
  const visiveis = filtrarContexto ? series.filter((s) => !s.contexto) : series
  if (!visiveis.length) return null
  return (
    <div className={`flex flex-wrap ${className}`}>
      {visiveis.map((s, i) => (
        <span key={i} className="text-xs text-text-secondary bg-white/5 rounded-md px-2 py-0.5">
          {fmtSerieExecutada(s, unidades)}
        </span>
      ))}
    </div>
  )
}
