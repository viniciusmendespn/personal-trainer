import { useEffect, useRef, useState } from 'react'

const fieldBase =
  'w-full px-3 py-2 rounded-lg bg-surface border border-border text-text placeholder-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50'

interface Props {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  label?: string
  placeholder?: string
  disabled?: boolean
}

export function AutocompleteInput({ value, onChange, suggestions, label, placeholder, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase(),
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

  return (
    <div ref={containerRef} className="relative block">
      {label && <span className="block text-xs font-medium text-text-secondary mb-1">{label}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={fieldBase}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg bg-surface-elevated border border-border shadow-lg">
          {filtered.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s); setOpen(false) }}
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
