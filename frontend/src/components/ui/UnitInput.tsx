import type { InputHTMLAttributes } from 'react'
import { Input } from './Input'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  unit?: string
  unitOptions?: string[]
  onUnitChange?: (unit: string) => void
}

export function UnitInput({ unit, unitOptions, onUnitChange, className = '', onChange, ...props }: Props) {
  function cycleUnit() {
    if (!unitOptions || !onUnitChange || !unit) return
    const idx = unitOptions.indexOf(unit)
    onUnitChange(unitOptions[(idx + 1) % unitOptions.length])
  }

  return (
    <div className="relative flex-1">
      <Input
        inputMode="decimal"
        className={`pr-14 ${className}`}
        onChange={(e) => {
          e.target.value = e.target.value.replace(/[^\d.]/g, '')
          onChange?.(e)
        }}
        {...props}
      />
      {unit && (
        unitOptions
          ? (
            <button
              type="button"
              onClick={cycleUnit}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-10 text-xs text-right text-accent-hover hover:text-accent px-0.5"
            >
              {unit}
            </button>
          )
          : (
            <span className="absolute right-1 top-1/2 -translate-y-1/2 w-10 text-xs text-right text-text-muted pointer-events-none select-none px-0.5">
              {unit}
            </span>
          )
      )}
    </div>
  )
}
