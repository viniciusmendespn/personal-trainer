import { useState } from 'react'
import { Button, Modal } from '../ui'

/** Legenda por faixa de PSE (escala CR10 de Borg simplificada). */
function pseLabel(v: number): string {
  if (v <= 0) return 'Repouso'
  if (v <= 2) return 'Muito leve'
  if (v <= 3) return 'Leve'
  if (v <= 5) return 'Moderado'
  if (v <= 7) return 'Puxado'
  if (v <= 9) return 'Muito puxado'
  return 'Máximo esforço'
}

/**
 * Modal de PSE (Percepção Subjetiva de Esforço) por exercício. Aparece ao registrar
 * um exercício de trabalho — força o aluno a informar o esforço (slider 0-10) ou marcar
 * "não sei dizer". Essa nota ajuda o personal a decidir se aumenta a carga.
 * onConfirm recebe o valor 0-10, ou undefined quando o aluno escolheu "não sei dizer".
 */
export function PseModal({ exercicioNome, submitting, onConfirm, onClose }: {
  exercicioNome: string
  submitting?: boolean
  onConfirm: (pse: number | undefined) => void
  onClose: () => void
}) {
  const [valor, setValor] = useState(5)
  const [touched, setTouched] = useState(false)
  const [naoSei, setNaoSei] = useState(false)

  const podeConfirmar = (touched || naoSei) && !submitting

  return (
    <Modal open onClose={onClose} title="Como foi o esforço?">
      <div className="space-y-5">
        <p className="text-sm text-text-secondary">
          Quão puxado foi <span className="font-medium text-text">{exercicioNome}</span>?
          Isso ajuda seu personal a ajustar a carga.
        </p>

        <div className={`space-y-3 transition-opacity ${naoSei ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex items-end justify-center gap-2">
            <span className="font-display text-4xl font-semibold text-energy tabular-nums">
              {touched ? valor : '–'}
            </span>
            <span className="text-sm text-text-muted mb-1.5">/ 10</span>
          </div>
          <p className="text-center text-sm font-medium text-text-secondary min-h-[1.25rem]">
            {touched ? pseLabel(valor) : 'Arraste para escolher'}
          </p>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={valor}
            disabled={naoSei}
            onChange={(e) => { setValor(Number(e.target.value)); setTouched(true) }}
            aria-label="Percepção de esforço de 0 a 10"
            className="w-full cursor-pointer"
            style={{ accentColor: 'var(--color-energy)' }}
          />
          <div className="flex justify-between text-[10px] text-text-muted px-0.5">
            <span>0 · leve</span>
            <span>10 · máximo</span>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={naoSei}
            onChange={(e) => setNaoSei(e.target.checked)}
            style={{ accentColor: 'var(--color-energy)' }}
          />
          Não sei dizer
        </label>

        <Button
          variant="energy"
          className="w-full"
          disabled={!podeConfirmar}
          onClick={() => onConfirm(naoSei ? undefined : valor)}
        >
          {submitting ? 'Registrando…' : 'Registrar'}
        </Button>
      </div>
    </Modal>
  )
}
