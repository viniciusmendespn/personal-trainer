import { useState, type ReactNode, type KeyboardEvent, type MouseEvent, type ElementType } from 'react'

/**
 * Texto que trunca por padrão e revela o conteúdo completo ao tocar/clicar.
 * Padrão da casa para conteúdo variável do usuário (nomes de aluno/treino/exercício,
 * títulos, etc.) — no mobile o personal precisa enxergar tudo. No desktop, o `title`
 * já entrega tooltip no hover.
 *
 * - `lines = 1` → `truncate`; `lines > 1` → `line-clamp-{n}`.
 * - Ao expandir, quebra em várias linhas (`whitespace-normal break-words`).
 * - `stopPropagation` no clique: muitos textos vivem dentro de cards/linhas clicáveis,
 *   então o tap no texto não deve disparar a ação do container.
 */
export function ExpandableText({
  children,
  text,
  lines = 1,
  className = '',
  as: Tag = 'span',
}: {
  children?: ReactNode
  /** Texto puro para o `title` (tooltip) e leitor de tela. Default: `children` se for string. */
  text?: string
  lines?: number
  className?: string
  as?: ElementType
}) {
  const [expanded, setExpanded] = useState(false)
  const title = text ?? (typeof children === 'string' ? children : undefined)

  // Classes estáticas — Tailwind não detecta `line-clamp-${n}` construído em runtime.
  const clampByLines: Record<number, string> = {
    2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4',
  }
  const clampClass = expanded
    ? 'whitespace-normal break-words'
    : lines <= 1
      ? 'truncate'
      : clampByLines[lines] ?? 'line-clamp-2'

  function toggle(e: MouseEvent) {
    e.stopPropagation()
    setExpanded((v) => !v)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      setExpanded((v) => !v)
    }
  }

  return (
    <Tag
      role="button"
      tabIndex={0}
      title={title}
      aria-expanded={expanded}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className={`cursor-pointer ${clampClass} ${className}`}
    >
      {children}
    </Tag>
  )
}
