import { useState } from 'react'
import { Timer, Repeat2, ListChecks } from 'lucide-react'
import { Button, Input, Modal } from '../ui'
import { DurationInput } from '../ui/DurationInput'
import { formatoBlocoLabel } from '../exercicios/BlocosTreinoEditor'
import type { BlocoTreino } from '../../types'
import type { ScoreBlocoInput } from '../../api/alunoApp'

const FIELD =
  'w-full px-3 py-2 rounded-lg bg-surface border border-border text-text text-center text-lg tabular-nums placeholder-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'

interface ScoreDraft {
  tempo_s?: number
  cap_estourado: boolean
  reps_restantes: string
  rounds: string
  reps_extras: string
  minutos_completos: string
  rx: boolean
}

/** Pré-preenchimento vindo do timer de WOD (quando o aluno usou o cronômetro). */
export interface WodPrefill {
  blocoId: string
  tempoS?: number
  rounds?: number
}

function draftInicial(b: BlocoTreino, prefill?: WodPrefill): ScoreDraft {
  const p = prefill?.blocoId === b.id ? prefill : undefined
  const emomMin = b.params?.duracao_s ? String(Math.round(b.params.duracao_s / 60)) : ''
  return {
    tempo_s: p?.tempoS,
    cap_estourado: false,
    reps_restantes: '',
    rounds: p?.rounds != null ? String(p.rounds) : '',
    reps_extras: '',
    minutos_completos: emomMin,   // default: completou tudo
    rx: true,
  }
}

/**
 * Pergunta o resultado de cada bloco de WOD ao finalizar a sessão (spec CROSSFIT §3.2):
 * FOR_TIME → tempo (ou cap + reps restantes); AMRAP → rounds + reps; EMOM → minutos
 * completos; RX/Adaptado por bloco. Pré-preenchido com o resultado do timer, se houver.
 */
export function ScoreWodModal({ blocos, prefill, submitting, onConfirm, onClose }: {
  blocos: BlocoTreino[]                 // só blocos pontuáveis (formato ≠ LIVRE, não aquecimento)
  prefill?: WodPrefill
  submitting?: boolean
  onConfirm: (scores: ScoreBlocoInput[]) => void
  onClose: () => void
}) {
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>(
    () => Object.fromEntries(blocos.map((b) => [b.id, draftInicial(b, prefill)]))
  )
  const upd = (id: string, patch: Partial<ScoreDraft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }))

  function montarScores(): ScoreBlocoInput[] {
    const out: ScoreBlocoInput[] = []
    for (const b of blocos) {
      const d = drafts[b.id]
      if (!d) continue
      if (b.formato === 'FOR_TIME') {
        if (d.cap_estourado) {
          out.push({ bloco_id: b.id, formato: b.formato, cap_estourado: true, reps_restantes: parseInt(d.reps_restantes, 10) || 0, rx: d.rx })
        } else if (d.tempo_s && d.tempo_s > 0) {
          out.push({ bloco_id: b.id, formato: b.formato, tempo_s: d.tempo_s, rx: d.rx })
        }
      } else if (b.formato === 'AMRAP') {
        const rounds = parseInt(d.rounds, 10)
        const extras = parseInt(d.reps_extras, 10)
        if (!isNaN(rounds) || !isNaN(extras)) {
          out.push({ bloco_id: b.id, formato: b.formato, rounds: isNaN(rounds) ? 0 : rounds, reps_extras: isNaN(extras) ? 0 : extras, rx: d.rx })
        }
      } else if (b.formato === 'EMOM') {
        const min = parseInt(d.minutos_completos, 10)
        if (!isNaN(min)) out.push({ bloco_id: b.id, formato: b.formato, minutos_completos: min, rx: d.rx })
      }
    }
    return out
  }

  const icone = (f: string) =>
    f === 'AMRAP' ? <Repeat2 size={14} /> : f === 'EMOM' ? <ListChecks size={14} /> : <Timer size={14} />

  return (
    <Modal open onClose={onClose} title="Resultado do WOD">
      <div className="space-y-4">
        {blocos.map((b) => {
          const d = drafts[b.id]
          if (!d) return null
          return (
            <div key={b.id} className="rounded-xl border border-border bg-surface-elevated p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-energy">{icone(b.formato)}</span>
                <span className="font-medium text-sm flex-1">{b.nome}</span>
                <span className="text-xs text-text-muted">{formatoBlocoLabel(b)}</span>
              </div>

              {b.formato === 'FOR_TIME' && (
                <div className="space-y-2">
                  {!d.cap_estourado && (
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Seu tempo</label>
                      <DurationInput
                        value={d.tempo_s}
                        onChange={(v) => upd(b.id, { tempo_s: v })}
                        inputClassName={FIELD}
                        ariaLabel="Tempo do WOD (m:ss)"
                        placeholder="m:ss"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={d.cap_estourado}
                      onChange={(e) => upd(b.id, { cap_estourado: e.target.checked })}
                    />
                    Não terminei dentro do time cap
                  </label>
                  {d.cap_estourado && (
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Reps que faltaram</label>
                      <Input
                        inputMode="numeric" placeholder="ex.: 14"
                        value={d.reps_restantes}
                        onChange={(e) => upd(b.id, { reps_restantes: e.target.value.replace(/\D/g, '') })}
                      />
                    </div>
                  )}
                </div>
              )}

              {b.formato === 'AMRAP' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Rounds completos</label>
                    <Input
                      inputMode="numeric" placeholder="ex.: 7"
                      value={d.rounds}
                      onChange={(e) => upd(b.id, { rounds: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Reps extras</label>
                    <Input
                      inputMode="numeric" placeholder="ex.: 12"
                      value={d.reps_extras}
                      onChange={(e) => upd(b.id, { reps_extras: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                </div>
              )}

              {b.formato === 'EMOM' && (
                <div>
                  <label className="text-xs text-text-muted mb-1 block">
                    Minutos completos{b.params?.duracao_s ? ` (de ${Math.round(b.params.duracao_s / 60)})` : ''}
                  </label>
                  <Input
                    inputMode="numeric"
                    value={d.minutos_completos}
                    onChange={(e) => upd(b.id, { minutos_completos: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
              )}

              <div className="flex gap-2">
                {([[true, 'RX (como prescrito)'], [false, 'Adaptado']] as const).map(([rx, label]) => (
                  <button
                    key={String(rx)}
                    type="button"
                    onClick={() => upd(b.id, { rx })}
                    className={`flex-1 text-xs py-1.5 px-2 rounded-lg border transition-colors ${
                      d.rx === rx
                        ? 'border-energy bg-energy/10 text-energy font-medium'
                        : 'border-border text-text-muted hover:border-border-strong'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        <Button variant="energy" className="w-full" disabled={submitting} onClick={() => onConfirm(montarScores())}>
          {submitting ? 'Finalizando…' : 'Salvar resultado e finalizar'}
        </Button>
        <button
          className="w-full text-sm text-text-muted hover:text-text transition-colors py-1"
          onClick={() => onConfirm([])}
          disabled={submitting}
        >
          Finalizar sem registrar resultado
        </button>
      </div>
    </Modal>
  )
}
