import { useEffect, useRef, useState } from 'react'

const fieldBase =
  'w-full px-3 py-2 rounded-lg bg-surface border border-border text-text placeholder-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50'

const PREDEFINIDOS = [
  'Hipertrofia',
  'Emagrecimento',
  'Ganho de força',
  'Resistência cardiovascular',
  'Saúde geral',
  'Reabilitação',
  'Condicionamento físico',
  'Flexibilidade',
  'Performance esportiva',
]

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  suggestions?: string[]
  label?: string
  disabled?: boolean
}

export function ObjetivosPicker({ value, onChange, suggestions = [], label, disabled }: Props) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const allSuggestions = [...new Set([...PREDEFINIDOS, ...suggestions])]
  const filtered = allSuggestions.filter(
    (s) =>
      s.toLowerCase().includes(input.toLowerCase()) &&
      !value.some((v) => v.toLowerCase() === s.toLowerCase()),
  )

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function add(obj: string) {
    const trimmed = obj.trim()
    if (!trimmed || value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return
    onChange([...value, trimmed])
    setInput('')
  }

  function remove(obj: string) {
    onChange(value.filter((v) => v !== obj))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (input.trim()) add(input)
    } else if (e.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div ref={containerRef} className="relative block">
      {label && <span className="block text-xs font-medium text-text-secondary mb-1">{label}</span>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((obj) => (
            <span
              key={obj}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent-hover border border-accent/30"
            >
              {obj}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(obj)}
                  className="ml-0.5 text-accent-hover/70 hover:text-accent-hover leading-none"
                  aria-label={`Remover ${obj}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={value.length === 0 ? 'Adicionar objetivo…' : 'Adicionar mais…'}
        disabled={disabled}
        className={fieldBase}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bottom-full mb-1 max-h-48 overflow-y-auto rounded-lg bg-surface-elevated border border-border shadow-lg">
          {filtered.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
              className="px-3 py-2 text-sm text-text cursor-pointer hover:bg-surface-hover"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
