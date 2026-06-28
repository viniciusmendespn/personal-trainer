import { useEffect, useState } from 'react'

const MAX_SECONDS = 99 * 60 + 59

function digitsToSeconds(digits: string): number {
  if (!digits) return 0
  const d = digits.slice(-4)
  const ss = parseInt(d.slice(-2) || '0', 10)
  const mm = parseInt(d.slice(0, -2) || '0', 10)
  return Math.min(MAX_SECONDS, mm * 60 + ss)
}

function secondsToDigits(value?: number): string {
  if (!value || value <= 0) return ''
  const total = Math.min(value, MAX_SECONDS)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}${String(s).padStart(2, '0')}`
}

function maskFromDigits(digits: string): string {
  if (!digits) return ''
  const d = digits.slice(-4)
  const ss = d.slice(-2).padStart(2, '0')
  const mm = d.slice(0, -2) || '0'
  return `${mm}:${ss}`
}

/**
 * Campo de duração com máscara m:ss usando o teclado numérico nativo
 * (`inputMode="numeric"`). Funciona de forma confiável em Android e iOS, sem
 * gestos/scroll customizados. Digita-se da direita p/ a esquerda (ex.: "130" → 1:30)
 * e o valor é normalizado no blur (ex.: 0:75 → 1:15).
 */
export function DurationInput({
  value,
  onChange,
  placeholder = 'm:ss',
  autoFocus,
  inputClassName = '',
  ariaLabel = 'Tempo em minutos e segundos',
  onEnter,
}: {
  value?: number
  onChange: (seconds: number | undefined) => void
  placeholder?: string
  autoFocus?: boolean
  inputClassName?: string
  ariaLabel?: string
  onEnter?: () => void
}) {
  const [digits, setDigits] = useState(() => secondsToDigits(value))

  // Ressincroniza quando o valor muda por fora (reset, +30s, etc.), não por digitação.
  useEffect(() => {
    if ((value ?? 0) !== digitsToSeconds(digits)) setDigits(secondsToDigits(value))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function handle(raw: string) {
    const dg = raw.replace(/\D/g, '').slice(-4)
    setDigits(dg)
    const secs = digitsToSeconds(dg)
    onChange(secs > 0 ? secs : undefined)
  }

  function normalize() {
    const secs = digitsToSeconds(digits)
    setDigits(secondsToDigits(secs))
    onChange(secs > 0 ? secs : undefined)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={maskFromDigits(digits)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      onChange={(e) => handle(e.target.value)}
      onBlur={normalize}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          normalize()
          onEnter?.()
          e.currentTarget.blur()
        }
      }}
      className={inputClassName}
    />
  )
}
