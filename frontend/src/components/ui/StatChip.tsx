import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'warning' | 'success'

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-surface-elevated border-border text-text-muted',
  accent: 'bg-accent/10 border-accent/30 text-accent-hover',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  success: 'bg-success/10 border-success/30 text-success',
}

/**
 * "Caixa" compacta de informação (métrica/label). Padrão único de chip de stat do app —
 * extraído do estilo inline usado no cabeçalho do treino (tempo médio / série).
 * Aceita `href` para virar um link (ex.: chip de vídeo).
 */
export function StatChip({
  icon,
  children,
  tone = 'neutral',
  href,
  onClick,
  title,
  className = '',
}: {
  icon?: ReactNode
  children: ReactNode
  tone?: Tone
  href?: string
  onClick?: () => void
  title?: string
  className?: string
}) {
  const base = `inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${toneStyles[tone]} ${className}`
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={title} className={`${base} hover:underline`}>
        {icon}
        {children}
      </a>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} className={`${base} hover:brightness-110`}>
        {icon}
        {children}
      </button>
    )
  }
  return (
    <span title={title} className={base}>
      {icon}
      {children}
    </span>
  )
}
