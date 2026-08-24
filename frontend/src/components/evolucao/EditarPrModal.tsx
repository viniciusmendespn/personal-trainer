import { useState } from 'react'
import type { ExercicioEvolucao, PrItem } from '../../api/evolucao'
import { Button, Input, Modal } from '../ui'
import { DurationInput } from '../ui/DurationInput'
import { decodeScoreValor, encodeScoreValor, fmtScoreValor } from '../../utils/wod'
import { normalizeTipoExercicio } from '../../types'

const FIELD =
  'w-full px-3 py-2 rounded-lg bg-surface border border-border text-text text-center text-lg tabular-nums placeholder-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'

/** Só dígitos, um separador decimal, sinal de menos à frente (contrapeso/graviton). */
function sanitizeCarga(v: string): string {
  const negativo = v.trim().startsWith('-')
  const corpo = v.replace(/[^\d.,]/g, '').replace(',', '.')
  const [inteiro, ...resto] = corpo.split('.')
  const decimal = resto.length ? `.${resto.join('').slice(0, 2)}` : ''
  return `${negativo ? '-' : ''}${inteiro}${decimal}`
}

export function EditarPrModal({ pr, ex, salvando, onSalvar, onClose }: {
  pr: PrItem
  ex?: ExercicioEvolucao
  salvando?: boolean
  onSalvar: (carga: number) => void
  onClose: () => void
}) {
  const isWod = !!pr.wod || !!pr.chave?.startsWith('wod#')
  const formato = pr.formato ?? ex?.formato
  const inicial = decodeScoreValor(formato, pr.carga)

  const [carga, setCarga] = useState(() => String(pr.carga ?? '').replace('.', ','))
  const [tempoS, setTempoS] = useState<number | undefined>(inicial.tempo_s)
  const [rounds, setRounds] = useState(inicial.rounds != null ? String(inicial.rounds) : '')
  const [repsExtras, setRepsExtras] = useState(inicial.reps_extras ? String(inicial.reps_extras) : '')
  const [minutos, setMinutos] = useState(inicial.minutos_completos != null ? String(inicial.minutos_completos) : '')

  const tipo = normalizeTipoExercicio(ex?.tipo_exercicio)
  const unidade = isWod
    ? null
    : tipo === 'PERFORMANCE' ? (ex?.unidade_reps || '') : (ex?.unidade_carga || 'kg')

  const valor = isWod
    ? encodeScoreValor(formato, {
        tempo_s: tempoS,
        rounds: rounds === '' ? null : Number(rounds),
        reps_extras: repsExtras === '' ? null : Number(repsExtras),
        minutos_completos: minutos === '' ? null : Number(minutos),
      })
    : (() => {
        const n = Number(carga.replace(',', '.'))
        return carga.trim() === '' || !Number.isFinite(n) ? null : n
      })()

  return (
    <Modal open onClose={onClose} title={`Corrigir recorde — ${pr.exercicio}`}>
      <div className="space-y-3">
        <p className="text-xs text-text-muted">
          Corrigir o recorde <b>não</b> gera pontos nem conquistas. A série registrada naquele dia
          continua no histórico e no gráfico — aqui você ajusta só o recorde.
        </p>

        <div className="rounded-lg bg-surface-elevated border border-border px-3 py-2 text-xs text-text-muted">
          Valor atual:{' '}
          <b className="text-text-secondary">
            {isWod ? fmtScoreValor(formato, pr.carga) : `${pr.carga}${unidade ? ` ${unidade}` : ''}`}
          </b>
        </div>

        {isWod && formato === 'FOR_TIME' && (
          <div>
            <label className="text-xs text-text-muted mb-1 block">Tempo</label>
            <DurationInput value={tempoS} onChange={setTempoS} inputClassName={FIELD} ariaLabel="Tempo do recorde (m:ss)" />
          </div>
        )}

        {isWod && formato === 'AMRAP' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Rounds completos</label>
              <Input inputMode="numeric" value={rounds} onChange={(e) => setRounds(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Reps extras</label>
              <Input inputMode="numeric" value={repsExtras} onChange={(e) => setRepsExtras(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
        )}

        {isWod && formato === 'EMOM' && (
          <div>
            <label className="text-xs text-text-muted mb-1 block">Minutos completos</label>
            <Input inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value.replace(/\D/g, ''))} />
          </div>
        )}

        {!isWod && (
          <div>
            <label className="text-xs text-text-muted mb-1 block">Novo valor</label>
            <div className="relative">
              <Input
                inputMode="decimal"
                autoFocus
                value={carga}
                onChange={(e) => setCarga(sanitizeCarga(e.target.value))}
                className="pr-10"
              />
              {unidade && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">
                  {unidade}
                </span>
              )}
            </div>
          </div>
        )}

        {isWod && !formato && (
          <p className="text-xs text-danger">Formato do WOD desconhecido — não é possível editar por aqui.</p>
        )}

        <Button
          className="w-full"
          disabled={salvando || valor == null || valor === pr.carga}
          onClick={() => valor != null && onSalvar(valor)}
        >
          {salvando ? 'Salvando…' : 'Salvar correção'}
        </Button>
      </div>
    </Modal>
  )
}
