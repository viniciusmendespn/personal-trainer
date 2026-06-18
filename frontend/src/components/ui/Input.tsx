import { useEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Search } from 'lucide-react'

const fieldBase =
  'w-full px-3 py-2 rounded-lg bg-surface border border-border text-text placeholder-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50'

function FieldLabel({ label, required }: { label?: string; required?: boolean }) {
  if (!label) return null
  return (
    <span className="block text-xs font-medium text-text-secondary mb-1">
      {label}
      {required && <span className="text-danger ml-0.5">*</span>}
    </span>
  )
}

export function Input({
  label,
  required,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      <input required={required} className={`${fieldBase} ${className}`} {...props} />
    </label>
  )
}

export function Textarea({
  label,
  required,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      <textarea required={required} className={`${fieldBase} min-h-24 resize-y ${className}`} {...props} />
    </label>
  )
}

export function Select({
  label,
  required,
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      <select required={required} className={`${fieldBase} ${className}`} {...props}>
        {children}
      </select>
    </label>
  )
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Buscar…',
  className = '',
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options
  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          className={`${fieldBase} pl-8 text-sm`}
          value={open ? query : selectedLabel}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={(e) => setQuery(e.target.value)}
          readOnly={!open}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-56 overflow-y-auto rounded-lg bg-surface-elevated border border-border shadow-lg">
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5 ${o.value === value ? 'text-accent-hover font-medium' : 'text-text'}`}
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(o.value)
                setOpen(false)
                setQuery('')
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
