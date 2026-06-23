import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Input } from '../ui'
import type { SeriePrescrita, TipoExercicio } from '../../types'

interface Props {
  value: SeriePrescrita[]
  onChange: (v: SeriePrescrita[]) => void
  tipoExercicio?: TipoExercicio
  rm_kg?: number
}

function getLabels(tipo?: TipoExercicio) {
  if (tipo === 'CARDIO') return { series: 'Blocos', reps: 'Dur./Dist.', carga: 'RPE (1-10)' }
  if (tipo === 'PESO_CORPORAL') return { series: 'Séries', reps: 'Reps', carga: null }
  return { series: 'Séries', reps: 'Reps', carga: 'Carga' }
}

export function SeriesPrescritasEditor({
  value, onChange, tipoExercicio, rm_kg,
}: Props) {
  const safeValue = Array.isArray(value) ? value : []
  const labels = getLabels(tipoExercicio)
  const showPct = !!rm_kg && rm_kg > 0 && tipoExercicio !== 'CARDIO' && tipoExercicio !== 'PESO_CORPORAL'

  const [pcts, setPcts] = useState<string[]>(() => safeValue.map(() => ''))

  function update(i: number, field: keyof SeriePrescrita, v: string) {
    onChange(safeValue.map((r, j) => j === i ? { ...r, [field]: field === 'series' ? Number(v) || 1 : v } : r))
  }
  function remove(i: number) {
    onChange(safeValue.filter((_, j) => j !== i))
    setPcts(p => p.filter((_, j) => j !== i))
  }
  function add() {
    onChange([...safeValue, { series: 1, reps: '', carga: undefined }])
    setPcts(p => [...p, ''])
  }

  return (
    <div className="space-y-2">
      {safeValue.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className="w-10 text-center"
            placeholder={labels.series}
            inputMode="numeric"
            value={row.series}
            onChange={(e) => update(i, 'series', e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <span className="text-text-muted text-xs shrink-0">×</span>
          <Input
            className="flex-1"
            placeholder={labels.reps}
            value={row.reps}
            onChange={(e) => update(i, 'reps', e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          {labels.carga !== null && (
            <>
              <span className="text-text-muted text-xs shrink-0">·</span>
              <Input
                className="flex-1"
                placeholder={labels.carga}
                value={row.carga ?? ''}
                onChange={(e) => update(i, 'carga', e.target.value)}
                onFocus={(e) => e.target.select()}
              />
              {showPct && (
                <div className="relative w-16 shrink-0">
                  <Input
                    className="pr-5 text-center"
                    inputMode="numeric"
                    placeholder="%"
                    value={pcts[i] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, '')
                      setPcts(p => p.map((x, j) => j === i ? v : x))
                      const pct = parseInt(v, 10)
                      if (!isNaN(pct) && pct > 0) {
                        update(i, 'carga', String(Math.round(pct * rm_kg! / 100)))
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">%</span>
                </div>
              )}
            </>
          )}
          {safeValue.length > 1 && (
            <button type="button" onClick={() => remove(i)} className="text-text-muted hover:text-danger shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 text-xs text-accent-hover hover:underline"
      >
        <Plus size={12} /> {tipoExercicio === 'CARDIO' ? 'bloco' : 'bloco de séries'}
      </button>
    </div>
  )
}

/** Resumo compacto para exibição: "2×10 · 30 + 1×6 · 40" */
export function SeriesPrescritasCompact({ items, tipoExercicio }: { items: SeriePrescrita[]; tipoExercicio?: TipoExercicio }) {
  if (!items.length) return null
  const ocultarCarga = tipoExercicio === 'PESO_CORPORAL'
  return (
    <span className="text-xs text-text-muted">
      {items.map((s, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1 opacity-50">+</span>}
          <span>{s.series}×{s.reps}{(!ocultarCarga && s.carga) ? ` · ${s.carga}` : ''}</span>
        </span>
      ))}
    </span>
  )
}

/** Inicializa lista de séries prescritas a partir dos campos flat (legado) */
export function initSeriesPrescritas(
  series_prescritas?: SeriePrescrita[] | null,
  series?: number,
  reps_prescritas?: string,
  carga_prescrita?: string,
): SeriePrescrita[] {
  if (series_prescritas?.length) return series_prescritas
  if (series) return [{ series, reps: reps_prescritas ?? '', carga: carga_prescrita ?? undefined }]
  return [{ series: 1, reps: '', carga: undefined }]
}
