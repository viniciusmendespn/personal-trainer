import { X, Plus } from 'lucide-react'
import { Input } from '../ui'
import type { SeriePrescrita } from '../../types'

interface Props {
  value: SeriePrescrita[]
  onChange: (v: SeriePrescrita[]) => void
}

export function SeriesPrescritasEditor({ value, onChange }: Props) {
  const safeValue = Array.isArray(value) ? value : []
  function update(i: number, field: keyof SeriePrescrita, v: string) {
    onChange(safeValue.map((r, j) => j === i ? { ...r, [field]: field === 'series' ? Number(v) || 1 : v } : r))
  }
  function remove(i: number) {
    onChange(safeValue.filter((_, j) => j !== i))
  }
  function add() {
    onChange([...safeValue, { series: 1, reps: '', carga: undefined }])
  }

  return (
    <div className="space-y-2">
      {safeValue.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className="w-16 text-center"
            placeholder="Séries"
            inputMode="numeric"
            value={row.series}
            onChange={(e) => update(i, 'series', e.target.value)}
          />
          <span className="text-text-muted text-xs shrink-0">×</span>
          <Input
            className="w-24"
            placeholder="Reps"
            value={row.reps}
            onChange={(e) => update(i, 'reps', e.target.value)}
          />
          <span className="text-text-muted text-xs shrink-0">·</span>
          <Input
            className="w-24"
            placeholder="Carga"
            value={row.carga ?? ''}
            onChange={(e) => update(i, 'carga', e.target.value)}
          />
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
        <Plus size={12} /> bloco de séries
      </button>
    </div>
  )
}

/** Resumo compacto para exibição: "2×10 · 30kg + 1×6 · 40kg" */
export function SeriesPrescritasCompact({ items }: { items: SeriePrescrita[] }) {
  if (!items.length) return null
  return (
    <span className="text-xs text-text-muted">
      {items.map((s, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1 opacity-50">+</span>}
          <span>{s.series}×{s.reps}{s.carga ? ` · ${s.carga}` : ''}</span>
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
