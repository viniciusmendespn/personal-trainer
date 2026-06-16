import type { ReactNode } from 'react'

type Variant = 'flat' | 'elevated' | 'glass'

const variantStyles: Record<Variant, string> = {
  flat: 'bg-surface border border-border',
  elevated: 'bg-surface border border-border shadow-[var(--shadow-card)]',
  glass: 'bg-surface/60 backdrop-blur-xl border border-border',
}

export function Card({
  children,
  className = '',
  variant = 'flat',
}: {
  children: ReactNode
  className?: string
  variant?: Variant
}) {
  return <div className={`${variantStyles[variant]} rounded-xl p-4 ${className}`}>{children}</div>
}
