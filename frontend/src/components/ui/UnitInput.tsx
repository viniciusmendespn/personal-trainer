import type { InputHTMLAttributes } from 'react'
import { Input } from './Input'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  unit?: string
  onUnitChange?: (unit: string) => void
}

export function UnitInput({ unit, onUnitChange, className = '', onChange, ...props }: Props) {
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
      <input
        type="text"
        value={unit ?? ''}
        onChange={(e) => onUnitChange?.(e.target.value)}
        onFocus={(e) => e.target.select()}
        readOnly={!onUnitChange}
        placeholder="un."
        className="absolute right-1 top-1/2 -translate-y-1/2 w-10 text-xs text-right bg-transparent border-none outline-none text-text-muted focus:text-text focus:bg-surface rounded px-0.5"
      />
    </div>
  )
}
