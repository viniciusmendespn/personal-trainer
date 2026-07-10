import { X, Plus, Flame, AlarmClock } from 'lucide-react'
import { Input, SortableList } from '../ui'
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

/** "AMRAP 15min · 5 rounds · desc. round 2:00", "For Time · 4 rounds · cap 20:00",
 * "EMOM 24min · a cada 1:30", "3 rounds" (circuito livre), "Aquecimento · 2 rounds".
 * Rounds/descansos são comuns a todos os formatos. */
export function formatoBlocoLabel(b: BlocoTreino): string | null {
  const p = b.params ?? {}
  const min = (s?: number) => (s ? (s % 60 === 0 ? `${s / 60}min` : fmtMS(s)) : '')
  if (b.descanso) return p.duracao_s ? `Descanso ${min(p.duracao_s)}` : 'Descanso'
  // Sufixos comuns a todos os formatos: repetições (rounds) e descanso entre rounds.
  const rep: string[] = []
  if (p.rounds && p.rounds > 1) rep.push(`${p.rounds} rounds`)
  if (p.descanso_rounds_s) rep.push(`desc. round ${min(p.descanso_rounds_s)}`)
  const join = (base: string | null): string | null =>
    ([base, ...rep].filter(Boolean).join(' · ')) || null

  if (b.aquecimento) return join('Aquecimento')
  switch (b.formato) {
    case 'FOR_TIME': {
      const parts = ['For Time']
      if (p.time_cap_s) parts.push(`cap ${min(p.time_cap_s)}`)
      return join(parts.join(' · '))
    }
    case 'AMRAP':
      return join(`AMRAP${p.duracao_s ? ` ${min(p.duracao_s)}` : ''}`)
    case 'EMOM': {
      const parts = ['EMOM']
      if (p.duracao_s) parts.push(min(p.duracao_s))
      if (p.intervalo_s && p.intervalo_s !== 60) parts.push(`a cada ${min(p.intervalo_s)}`)
      return join(parts.join(' · '))
    }
    default:
      // Circuito livre: só os sufixos comuns (ex.: "3 rounds · desc. round 1:00")
      return join(null)
  }
}

/** Sufixo da prescrição por unidade de repetição do bloco ("por round" / "por minuto"). */
export function sufixoPrescricaoBloco(b?: BlocoTreino | null): string | null {
  if (!b) return null
  const rounds = b.params?.rounds ?? 0
  if (b.formato === 'EMOM') return 'por minuto'
  if (b.formato === 'AMRAP' || rounds > 1) return 'por round'
  return null
}

/** Formata a prescrição "por round/minuto" incluindo a unidade da métrica (ex.: "30 cal",
 * "500 m") — sem isso, exercícios PERFORMANCE ficavam sem a unidade nesse modo de exibição. */
export function fmtPrescricaoBloco(
  items: { reps: string; carga?: string | null }[],
  unidadeReps?: string | null,
): string {
  const un = unidadeReps ? ` ${unidadeReps}` : ''
  return items.map((s) => `${s.reps}${un}${s.carga ? ` · ${s.carga}` : ''}`).join(' + ')
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
  function reordenar(newBlocos: BlocoTreino[]) {
    onChange(newBlocos.map((b, j) => ({ ...b, ordem: j })))
  }
  function add() {
    const letra = String.fromCharCode(65 + blocos.length) // A, B, C…
    onChange([...blocos, {
      id: novoBlocoId(), nome: blocos.length === 0 ? 'Aquecimento' : `${letra}) `,
      ordem: blocos.length, formato: 'LIVRE', params: {}, aquecimento: blocos.length === 0,
    }])
  }
  /** Bloco de descanso entre blocos: sem exercícios, só duração (params.duracao_s). */
  function addDescanso() {
    onChange([...blocos, {
      id: novoBlocoId(), nome: 'Descanso', ordem: blocos.length,
      formato: 'LIVRE', params: { duracao_s: 120 }, descanso: true,
    }])
  }

  /** Linha comum a todos os formatos: quantas vezes repetir o bloco (rounds) + descanso
   * entre rounds. O descanso ENTRE blocos é um bloco de descanso próprio (botão "+ descanso"). */
  const repeticaoRow = (b: BlocoTreino, i: number) => (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-text-muted">
        Rounds <span className="opacity-70">(repetir)</span>
        <Input
          inputMode="numeric" placeholder="ex.: 5" className="mt-1"
          value={b.params?.rounds ?? ''}
          onChange={(e) => updateParams(i, { rounds: parseInt(e.target.value, 10) || undefined })}
        />
      </label>
      <label className="text-xs text-text-muted">
        Desc. entre rounds
        <DurationInput
          value={b.params?.descanso_rounds_s}
          onChange={(v) => updateParams(i, { descanso_rounds_s: v })}
          inputClassName={DUR_FIELD}
          ariaLabel="Descanso entre rounds (m:ss)"
        />
      </label>
    </div>
  )

  return (
    <div>
      <p className="text-xs font-medium text-text-secondary mb-2">
        Blocos <span className="font-normal text-text-muted">(opcional — para treinos por partes: aquecimento, força, metcon…)</span>
      </p>
      <div className="space-y-2">
        <SortableList items={blocos} getId={(b) => b.id} onReorder={reordenar}>
          {(b, i, p) => (
          b.descanso ? (
          <div ref={p.setNodeRef} style={p.style} className="rounded-lg border border-dashed border-accent/40 bg-accent/5 p-2.5 mb-2 flex items-center gap-2">
            {p.handle}
            <AlarmClock size={14} className="text-accent shrink-0" />
            <span className="text-xs font-medium text-text-secondary shrink-0">Descanso entre blocos</span>
            <div className="w-24">
              <DurationInput
                value={b.params?.duracao_s}
                onChange={(v) => updateParams(i, { duracao_s: v })}
                inputClassName={DUR_FIELD}
                ariaLabel="Duração do descanso (m:ss)"
              />
            </div>
            <button type="button" onClick={() => remove(i)} className="text-text-muted hover:text-danger shrink-0 ml-auto" aria-label="Remover descanso">
              <X size={14} />
            </button>
          </div>
          ) : (
          <div ref={p.setNodeRef} style={p.style} className="rounded-lg border border-border bg-white/5 p-2.5 space-y-2 mb-2">
            <div className="flex items-center gap-2">
              {p.handle}
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
            {b.aquecimento && repeticaoRow(b, i)}
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
                  <label className="text-xs text-text-muted block">
                    Time cap
                    <DurationInput
                      value={b.params?.time_cap_s}
                      onChange={(v) => updateParams(i, { time_cap_s: v })}
                      inputClassName={DUR_FIELD}
                      ariaLabel="Time cap (m:ss)"
                    />
                  </label>
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
                <div className="pt-1 border-t border-border/60 space-y-1">
                  {repeticaoRow(b, i)}
                  <p className="text-[11px] text-text-muted leading-snug">
                    <b>Rounds</b> = quantas vezes repetir o bloco (ex.: AMRAP 3:00 com 5 rounds e
                    2:00 de descanso entre rounds). Para uma pausa entre blocos, use <b>+ descanso</b> abaixo.
                  </p>
                </div>
              </>
            )}
          </div>
          )
          )}
        </SortableList>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 text-xs text-accent-hover hover:underline"
          >
            <Plus size={12} /> bloco
          </button>
          <button
            type="button"
            onClick={addDescanso}
            className="inline-flex items-center gap-1 text-xs text-accent-hover hover:underline"
          >
            <Plus size={12} /> descanso
          </button>
        </div>
      </div>
    </div>
  )
}
