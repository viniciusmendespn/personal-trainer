import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from './Card'

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'accent',
  className = '',
  to,
}: {
  icon?: ReactNode
  label: string
  value: ReactNode
  hint?: string
  tone?: 'accent' | 'energy' | 'success' | 'warning' | 'danger'
  className?: string
  to?: string
}) {
  const toneStyles = {
    accent: 'bg-accent/15 text-accent-hover',
    energy: 'bg-energy/15 text-energy',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
  }[tone]

  const card = (
    <Card
      variant="elevated"
      className={`flex items-start gap-3 ${to ? 'cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all' : ''} ${className}`}
    >
      {icon && <div className={`p-2 rounded-lg ${toneStyles} [&>svg]:w-5 [&>svg]:h-5`}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs text-text-secondary">{label}</p>
        <p className="font-display text-2xl font-bold text-text mt-0.5 truncate">{value}</p>
        {hint && <p className="text-[11px] text-text-muted mt-0.5">{hint}</p>}
      </div>
    </Card>
  )

  return to ? <Link to={to} className="block">{card}</Link> : card
}
