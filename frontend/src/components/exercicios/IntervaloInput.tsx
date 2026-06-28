import { DurationInput } from '../ui/DurationInput'

const FIELD_CLASSES =
  'w-32 px-3 py-2 rounded-lg bg-surface border border-border text-text text-center text-lg tabular-nums placeholder-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'

/**
 * Entrada do tempo de intervalo/descanso de um exercício (em segundos), com máscara
 * m:ss e teclado numérico nativo — mesmo padrão do cronômetro do aluno.
 */
export function IntervaloInput({
  value,
  onChange,
  label = 'Intervalo de descanso',
}: {
  value?: number
  onChange: (segundos: number | undefined) => void
  label?: string
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-text-secondary mb-1">{label}</span>
      <DurationInput
        value={value}
        onChange={onChange}
        placeholder="m:ss"
        ariaLabel="Intervalo de descanso (minutos e segundos)"
        inputClassName={FIELD_CLASSES}
      />
      <p className="text-xs text-text-muted mt-1">
        Formato m:ss (ex.: 1:30). Carregado no cronômetro do aluno ao expandir o exercício. Vazio = padrão 1:30.
      </p>
    </div>
  )
}
