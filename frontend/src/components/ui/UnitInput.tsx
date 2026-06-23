import type { InputHTMLAttributes } from 'react'
import { Input } from './Input'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  unit?: string
}

export function UnitInput({ unit, className = '', ...props }: Props) {
  return (
    <div className="relative flex-1">
      <Input
        inputMode="decimal"
        className={`${unit ? 'pr-10' : ''} ${className}`}
        {...props}
      />
      {unit && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none select-none">
          {unit}
        </span>
      )}
    </div>
  )
}
