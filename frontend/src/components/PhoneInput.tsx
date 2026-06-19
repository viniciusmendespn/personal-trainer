import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

interface Country {
  code: string
  name: string
  dial: string
}

const COUNTRIES: Country[] = [
  { code: 'BR', name: 'Brasil', dial: '55' },
  { code: 'US', name: 'Estados Unidos', dial: '1' },
  { code: 'PT', name: 'Portugal', dial: '351' },
  { code: 'AR', name: 'Argentina', dial: '54' },
  { code: 'MX', name: 'México', dial: '52' },
  { code: 'CO', name: 'Colômbia', dial: '57' },
  { code: 'CL', name: 'Chile', dial: '56' },
  { code: 'ES', name: 'Espanha', dial: '34' },
]

function FlagImg({ code }: { code: string }) {
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w40/${code.toLowerCase()}.png 2x`}
      width={20}
      alt={code}
      className="rounded-sm object-cover"
      style={{ height: 15 }}
    />
  )
}

function maskBR(digits: string): string {
  if (digits.length <= 10) {
    const area = digits.slice(0, 2)
    const part1 = digits.slice(2, 6)
    const part2 = digits.slice(6, 10)
    if (digits.length <= 2) return area ? `(${area}` : ''
    if (digits.length <= 6) return `(${area}) ${part1}`
    return `(${area}) ${part1}-${part2}`
  }
  const area = digits.slice(0, 2)
  const part1 = digits.slice(2, 7)
  const part2 = digits.slice(7, 11)
  if (digits.length <= 7) return `(${area}) ${part1}`
  return `(${area}) ${part1}-${part2}`
}

export interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  label?: string
  required?: boolean
}

export function PhoneInput({ value, onChange, disabled, label, required }: PhoneInputProps) {
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [localDisplay, setLocalDisplay] = useState('')
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value) { setLocalDisplay(''); return }
    if (value.startsWith(country.dial)) {
      const local = value.slice(country.dial.length)
      setLocalDisplay(country.dial === '55' ? maskBR(local) : local)
    }
  }, [value, country.dial])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectCountry(c: Country) {
    setCountry(c)
    setLocalDisplay('')
    onChange('')
    setOpen(false)
  }

  function handleLocalChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, country.dial === '55' ? 11 : 15)
    setLocalDisplay(country.dial === '55' ? maskBR(digits) : digits)
    onChange(country.dial + digits)
  }

  const placeholder = country.dial === '55' ? '(11) 99999-9999' : 'Número local'

  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-medium text-text-secondary mb-1">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
      )}
      <div className="flex rounded-lg overflow-visible border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 transition-colors relative">
        <div ref={dropdownRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => !disabled && setOpen((o) => !o)}
            disabled={disabled}
            className="flex items-center gap-1.5 bg-surface-elevated text-text text-sm px-3 py-2 border-r border-border rounded-l-lg h-full focus:outline-none cursor-pointer disabled:cursor-not-allowed select-none"
          >
            <FlagImg code={country.code} />
            <span className="text-text-secondary text-xs">+{country.dial}</span>
            <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-surface-elevated border border-border rounded-lg shadow-xl overflow-hidden min-w-[180px]">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => selectCountry(c)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors ${c.code === country.code ? 'bg-white/5 text-text' : 'text-text-secondary'}`}
                >
                  <FlagImg code={c.code} />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-text-muted text-xs">+{c.dial}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          value={localDisplay}
          onChange={(e) => handleLocalChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="flex-1 bg-surface text-text text-sm px-3 py-2 focus:outline-none min-w-0 rounded-r-lg placeholder-text-muted disabled:opacity-50"
        />
      </div>
    </label>
  )
}
