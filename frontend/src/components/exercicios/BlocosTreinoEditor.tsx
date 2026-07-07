import { X, Plus, Flame } from 'lucide-react'
import { Input } from '../ui'
import { DurationInput } from '../ui/DurationInput'
import type { BlocoTreino, FormatoBloco } from '../../types'

/** Gera id estável para blocos criados no cliente (referenciado por Exercicio.bloco_id). */
function novoBlocoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
}

const DUR_FIELD =
  'mt-1 w-full px-2 py-1.5 rounded-lg bg-surface border border-border text-text text-sm tabular-nums placeholder-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'

const FORMATOS: { value: FormatoBloco; label: string }[] = [
  { value: 'LIVRE', label: 'Livre' },
  { value: 'FOR_TIME', label: 'For Time' },
  { value: 'AMRAP', label: 'AMRAP' },
  { value: 'EMOM', label: 'EMOM' },
]

/** "AMRAP 15min", "For Time · 4 rounds · cap 20:00", "EMOM 24min · a cada 1:30" */
export function formatoBlocoLabel(b: BlocoTreino): string | null {
  if (b.aquecimento) return 'Aquecimento'
  const p = b.params ?? {}
  const min = (s?: number) => (s ? (s % 60 === 0 ? `${s / 60}min` : fmtMS(s)) : '')
  switch (b.formato) {
    case 'FOR_TIME': {
      const parts = ['For Time']
      if (p.rounds) parts.push(`${p.rounds} rounds`)
      if (p.time_cap_s) parts.push(`cap ${min(p.time_cap_s)}`)
      if (p.descanso_rounds_s) parts.push(`desc. ${min(p.descanso_rounds_s)}`)
      return parts.join(' · ')
    }
    case 'AMRAP':
      return `AMRAP${p.duracao_s ? ` ${min(p.duracao_s)}` : ''}`
    case 'EMOM': {
      const parts = ['EMOM']
      if (p.duracao_s) parts.push(min(p.duracao_s))
      if (p.intervalo_s && p.intervalo_s !== 60) parts.push(`a cada ${min(p.intervalo_s)}`)
      return parts.join(' · ')
    }
    default:
      return null
  }
}

function fmtMS(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Editor de blocos do treino (CrossFit/HIIT) — opcional: treino sem blocos segue o fluxo
 * clássico. Cada bloco tem formato (For Time/AMRAP/EMOM) com parâmetros próprios, ou é
 * marcado como aquecimento (sem formato/score).
 */
export function BlocosTreinoEditor({ value, onChange }: {
  value: BlocoTreino[]
  onChange: (blocos: BlocoTreino[]) => void
}) {
  const blocos = Array.isArray(value) ? value : []

  function update(i: number, patch: Partial<BlocoTreino>) {
    onChange(blocos.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  }
  function updateParams(i: number, patch: Record<string, number | undefined>) {
    const b = blocos[i]
    update(i, { params: { ...(b.params ?? {}), ...patch } })
  }
  function remove(i: number) {
    onChange(blocos.filter((_, j) => j !== i).map((b, j) => ({ ...b, ordem: j })))
  }
  function add() {
    const letra = String.fromCharCode(65 + blocos.length) // A, B, C…
    onChange([...blocos, {
      id: novoBlocoId(), nome: blocos.length === 0 ? 'Aquecimento' : `${letra}) `,
      ordem: blocos.length, formato: 'LIVRE', params: {}, aquecimento: blocos.length === 0,
    }])
  }

  return (
    <div>
      <p className="text-xs font-medium text-text-secondary mb-2">
        Blocos <span className="font-normal text-text-muted">(opcional — para treinos por partes: aquecimento, força, metcon…)</span>
      </p>
      <div className="space-y-2">
        {blocos.map((b, i) => (
          <div key={b.id} className="rounded-lg border border-border bg-white/5 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder={`ex.: ${i === 0 ? 'Aquecimento' : 'C) Metcon'}`}
                value={b.nome}
                onChange={(e) => update(i, { nome: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-text-muted shrink-0 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!b.aquecimento}
                  onChange={(e) => update(i, { aquecimento: e.target.checked, ...(e.target.checked ? { formato: 'LIVRE' as FormatoBloco } : {}) })}
                />
                <Flame size={12} className="text-warning" /> aquec.
              </label>
              <button type="button" onClick={() => remove(i)} className="text-text-muted hover:text-danger shrink-0" aria-label="Remover bloco">
                <X size={14} />
              </button>
            </div>
            {!b.aquecimento && (
              <>
                <div className="flex gap-1.5">
                  {FORMATOS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update(i, { formato: opt.value })}
                      className={`flex-1 text-xs py-1 px-1.5 rounded-lg border transition-colors ${
                        b.formato === opt.value
                          ? 'border-accent bg-accent/10 text-accent-hover font-medium'
                          : 'border-border text-text-muted hover:border-border-strong'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {b.formato === 'FOR_TIME' && (
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs text-text-muted">
                      Rounds
                      <Input
                        inputMode="numeric" placeholder="ex.: 4" className="mt-1"
                        value={b.params?.rounds ?? ''}
                        onChange={(e) => updateParams(i, { rounds: parseInt(e.target.value, 10) || undefined })}
                      />
                    </label>
                    <label className="text-xs text-text-muted">
                      Time cap
                      <DurationInput
                        value={b.params?.time_cap_s}
                        onChange={(v) => updateParams(i, { time_cap_s: v })}
                        inputClassName={DUR_FIELD}
                        ariaLabel="Time cap (m:ss)"
                      />
                    </label>
                    <label className="text-xs text-text-muted">
                      Desc./round
                      <DurationInput
                        value={b.params?.descanso_rounds_s}
                        onChange={(v) => updateParams(i, { descanso_rounds_s: v })}
                        inputClassName={DUR_FIELD}
                        ariaLabel="Descanso entre rounds (m:ss)"
                      />
                    </label>
                  </div>
                )}
                {b.formato === 'AMRAP' && (
                  <label className="text-xs text-text-muted block">
                    Duração
                    <DurationInput
                      value={b.params?.duracao_s}
                      onChange={(v) => updateParams(i, { duracao_s: v })}
                      inputClassName={DUR_FIELD}
                      ariaLabel="Duração do AMRAP (m:ss)"
                    />
                  </label>
                )}
                {b.formato === 'EMOM' && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-text-muted">
                      A cada
                      <DurationInput
                        value={b.params?.intervalo_s ?? 60}
                        onChange={(v) => updateParams(i, { intervalo_s: v })}
                        inputClassName={DUR_FIELD}
                        ariaLabel="Intervalo do EMOM (m:ss)"
                      />
                    </label>
                    <label className="text-xs text-text-muted">
                      Duração total
                      <DurationInput
                        value={b.params?.duracao_s}
                        onChange={(v) => updateParams(i, { duracao_s: v })}
                        inputClassName={DUR_FIELD}
                        ariaLabel="Duração total do EMOM (m:ss)"
                      />
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-xs text-accent-hover hover:underline"
        >
          <Plus size={12} /> bloco
        </button>
      </div>
    </div>
  )
}
