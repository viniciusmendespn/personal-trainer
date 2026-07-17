import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Input } from '../ui'
import type { SeriePrescrita, TipoExercicio } from '../../types'

interface Props {
  value: SeriePrescrita[]
  onChange: (v: SeriePrescrita[]) => void
  tipoExercicio?: TipoExercicio
  unidadeReps?: string
  unidadeCarga?: string
  rm_kg?: number
}

function getLabels(tipo?: TipoExercicio, unidadeReps?: string, unidadeCarga?: string) {
  // PERFORMANCE com 2ª medida (unidade_carga preenchida): coluna extra rotulada por ela
  if (tipo === 'PERFORMANCE') return { series: 'Séries', reps: unidadeReps || 'Métrica', carga: unidadeCarga || null }
  return { series: 'Séries', reps: 'Reps', carga: 'Carga' }
}

export function SeriesPrescritasEditor({
  value, onChange, tipoExercicio, unidadeReps, unidadeCarga, rm_kg,
}: Props) {
  const safeValue = Array.isArray(value) ? value : []
  const labels = getLabels(tipoExercicio, unidadeReps, unidadeCarga)
  const showPct = !!rm_kg && rm_kg > 0 && tipoExercicio !== 'PERFORMANCE'

  const [pcts, setPcts] = useState<string[]>(() => safeValue.map(() => ''))

  function update(i: number, field: keyof SeriePrescrita, v: string) {
    onChange(safeValue.map((r, j) => j === i ? { ...r, [field]: field === 'series' ? Number(v) || 1 : v } : r))
  }
  function toggleAquecimento(i: number) {
    onChange(safeValue.map((r, j) => j === i ? { ...r, aquecimento: !r.aquecimento || undefined } : r))
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
          <button
            type="button"
            onClick={() => toggleAquecimento(i)}
            title="Série de aquecimento (não conta para PR/volume/pontos)"
            className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md border transition-colors ${
              row.aquecimento
                ? 'border-warning/50 bg-warning/15 text-warning'
                : 'border-border text-text-muted hover:border-border-strong'
            }`}
          >
            aq.
          </button>
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

/** Formata UMA série prescrita já com a unidade, conforme o tipo do exercício
 * (mesma convenção de `execLabel`):
 * - FORCA: `reps` é contagem (sem unidade); `carga` recebe `unidadeCarga || 'kg'`.
 * - PERFORMANCE: `reps` é a métrica (unidadeReps); `carga` é contexto (unidadeCarga, se houver).
 * - tipo indefinido: sem unidade (comportamento legado preservado).
 * Não inclui o separador "+" nem o estilo de aquecimento — isso fica a cargo de quem mapeia. */
export function fmtSerieCompacta(
  s: SeriePrescrita,
  { tipo, unidadeCarga, unidadeReps, pct }: {
    tipo?: TipoExercicio; unidadeCarga?: string | null; unidadeReps?: string | null; pct?: number | null
  } = {},
): string {
  const perf = tipo === 'PERFORMANCE'
  const base = `${s.series}×${s.reps}${perf && unidadeReps ? ` ${unidadeReps}` : ''}`
  if (!s.carga) return base
  // `||` cobre null/undefined/'' — FORCA implica kg; PERFORMANCE só mostra unidade se definida.
  const uc = perf ? (unidadeCarga || '') : (tipo === 'FORCA' ? (unidadeCarga || 'kg') : '')
  const pctStr = pct != null ? ` (${pct}%)` : ''
  return `${base} · ${s.carga}${uc ? ` ${uc}` : ''}${pctStr}`
}

/** Versão da formatação com unidade para os campos flat legados
 * (series / reps_prescritas / carga_prescrita) — itens antigos sem `series_prescritas`. */
export function fmtPrescricaoFlat(
  ex: { series?: number | null; reps_prescritas?: string | null; carga_prescrita?: string | null },
  { tipo, unidadeCarga, unidadeReps }: {
    tipo?: TipoExercicio; unidadeCarga?: string | null; unidadeReps?: string | null
  } = {},
): string {
  const perf = tipo === 'PERFORMANCE'
  const reps = `${ex.series ? `${ex.series}x` : ''}${ex.reps_prescritas ?? ''}${perf && unidadeReps ? ` ${unidadeReps}` : ''}`.trim()
  if (!ex.carga_prescrita) return reps
  const uc = perf ? (unidadeCarga || '') : (tipo === 'FORCA' ? (unidadeCarga || 'kg') : '')
  return [reps, `${ex.carga_prescrita}${uc ? ` ${uc}` : ''}`].filter(Boolean).join(' · ')
}

/** Resumo compacto para exibição: "2×10 · 132 kg (88%) + 1×6 · 140 kg (93%)" */
export function SeriesPrescritasCompact({ items, tipoExercicio, unidadeCarga, unidadeReps, rm_kg }: {
  items: SeriePrescrita[]; tipoExercicio?: TipoExercicio; unidadeCarga?: string | null; unidadeReps?: string | null; rm_kg?: number
}) {
  if (!items.length) return null
  return (
    <span className="text-xs text-text-muted">
      {items.map((s, i) => {
        const cargaNum = s.carga ? parseFloat(String(s.carga).replace(',', '.')) : NaN
        const pct = rm_kg && rm_kg > 0 && !isNaN(cargaNum) ? Math.round(cargaNum / rm_kg * 100) : null
        return (
          <span key={i}>
            {i > 0 && <span className="mx-1 opacity-50">+</span>}
            <span className={s.aquecimento ? 'opacity-60' : ''}>
              {fmtSerieCompacta(s, { tipo: tipoExercicio, unidadeCarga, unidadeReps, pct })}
              {s.aquecimento ? <span className="ml-0.5 text-[10px] text-warning">aq.</span> : ''}
            </span>
          </span>
        )
      })}
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
