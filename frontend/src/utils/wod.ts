import type { FormatoBloco } from '../types'

/** Formata segundos como m:ss (ex.: 582 → "9:42"). */
export function fmtTempoWod(s?: number | null): string {
  if (s == null || s <= 0) return '—'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`
}

/** Score legível de um bloco de WOD (resultado informado na finalização). */
export function fmtScoreWod(sc: {
  formato?: string
  tempo_s?: number | null
  cap_estourado?: boolean
  reps_restantes?: number | null
  rounds?: number | null
  reps_extras?: number | null
  minutos_completos?: number | null
}): string {
  switch (sc.formato) {
    case 'FOR_TIME':
      if (sc.cap_estourado) return `cap${sc.reps_restantes ? ` −${sc.reps_restantes} reps` : ''}`
      return fmtTempoWod(sc.tempo_s)
    case 'AMRAP':
      return `${sc.rounds ?? 0} round${(sc.rounds ?? 0) === 1 ? '' : 's'}${sc.reps_extras ? ` + ${sc.reps_extras}` : ''}`
    case 'EMOM':
      return sc.minutos_completos != null ? `${sc.minutos_completos} min` : '—'
    default:
      return '—'
  }
}

/** Formata o score ordenável (STATS#PR / evolução) de volta para exibição por formato.
 * FOR_TIME guarda segundos; AMRAP guarda rounds*1000+reps; EMOM guarda minutos. */
export function fmtScoreValor(formato: FormatoBloco | string | undefined, valor?: number | null): string {
  if (valor == null) return '—'
  switch (formato) {
    case 'FOR_TIME':
      return fmtTempoWod(valor)
    case 'AMRAP': {
      const rounds = Math.floor(valor / 1000)
      const reps = Math.round(valor % 1000)
      return `${rounds} rd${reps ? ` + ${reps}` : ''}`
    }
    case 'EMOM':
      return `${Math.round(valor)} min`
    default:
      return String(valor)
  }
}
