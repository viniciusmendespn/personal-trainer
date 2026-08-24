import type { TipoExercicio } from '../types'

/** Uma série executada, como o backend grava em `series_exec`. */
export interface SerieExecutada {
  carga?: string
  reps?: number
  contexto?: boolean
}

export interface UnidadesExercicio {
  tipo: TipoExercicio
  unidadeCarga?: string | null
  unidadeReps?: string | null
}

/** Rótulo de uma série executada ("12 reps · 60 kg"). Fonte única: antes existiam três
 * cópias divergentes (detalhe da sessão + as duas "última vez"), e só esta tratava
 * unidade nula. */
export function fmtSerieExecutada(s: SerieExecutada, { tipo, unidadeCarga, unidadeReps }: UnidadesExercicio): string {
  // `||` cobre null/undefined/'' — default params só cobrem undefined, e o backend grava null
  // p/ FORÇA (kg/reps implícitos), o que renderizava a unidade literal "null".
  const uc = unidadeCarga || 'kg'
  const ur = unidadeReps || 'reps'
  // Anotação dentro de bloco de WOD (contexto): só a carga usada — o resultado é o score do bloco
  if (s.contexto || (s.reps == null && s.carga)) {
    return s.carga ? `Carga usada: ${s.carga} ${uc}` : '—'
  }
  if (tipo === 'PERFORMANCE') {
    // 2ª medida (spec CROSSFIT §3.6): carga registrada em PERFORMANCE é contexto (ex.: min, kcal)
    const extra = s.carga ? ` · ${s.carga} ${unidadeCarga || ''}`.trimEnd() : ''
    return s.reps != null ? `${s.reps} ${ur}`.trimEnd() + extra : '—'
  }
  return `${s.reps != null ? `${s.reps} ${ur}` : '—'}${s.carga ? ` · ${s.carga} ${uc}` : ''}`
}
