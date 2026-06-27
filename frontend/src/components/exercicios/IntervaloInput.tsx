import { useState } from 'react'
import { Input } from '../ui/Input'

type Unidade = 'seg' | 'min'

/**
 * Entrada do tempo de intervalo/descanso de um exercício.
 * Persiste sempre em segundos (via `onChange`), mas permite o personal digitar
 * em segundos ou minutos através do alternador de unidade.
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
  // Exibe em minutos quando o valor é um múltiplo "redondo" de 60.
  const [unidade, setUnidade] = useState<Unidade>(
    value != null && value >= 60 && value % 60 === 0 ? 'min' : 'seg'
  )
  const [texto, setTexto] = useState<string>(
    value == null ? '' : unidade === 'min' ? String(value / 60) : String(value)
  )

  function emit(t: string, u: Unidade) {
    const n = parseFloat(t.replace(',', '.'))
    if (!t || Number.isNaN(n) || n <= 0) {
      onChange(undefined)
      return
    }
    onChange(Math.round(u === 'min' ? n * 60 : n))
  }

  function onTexto(t: string) {
    setTexto(t)
    emit(t, unidade)
  }

  function onUnidade(u: Unidade) {
    if (u === unidade) return
    const n = parseFloat(texto.replace(',', '.'))
    let novoTexto = texto
    if (!Number.isNaN(n) && n > 0) {
      const seg = unidade === 'min' ? n * 60 : n
      const novo = u === 'min' ? seg / 60 : seg
      novoTexto = String(Number(novo.toFixed(2)))
    }
    setUnidade(u)
    setTexto(novoTexto)
    emit(novoTexto, u)
  }

  return (
    <div>
      <span className="block text-xs font-medium text-text-secondary mb-1">{label}</span>
      <div className="flex gap-2">
        <Input
          type="number"
          min={0}
          step={unidade === 'min' ? 0.5 : 5}
          inputMode="decimal"
          className="flex-1"
          placeholder={unidade === 'min' ? 'ex.: 1.5' : 'ex.: 90'}
          value={texto}
          onChange={(e) => onTexto(e.target.value)}
        />
        <div className="flex gap-1 shrink-0">
          {(['seg', 'min'] as Unidade[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => onUnidade(u)}
              className={`text-xs py-1.5 px-3 rounded-lg border transition-colors ${
                unidade === u
                  ? 'border-accent bg-accent/10 text-accent-hover font-medium'
                  : 'border-border text-text-muted hover:border-border-strong'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-text-muted mt-1">
        Carregado no cronômetro do aluno ao expandir o exercício. Deixe vazio para não definir.
      </p>
    </div>
  )
}
