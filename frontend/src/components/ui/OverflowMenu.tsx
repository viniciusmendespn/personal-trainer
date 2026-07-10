import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'

export type OverflowMenuItem = {
  icon?: ReactNode
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}

/**
 * Menu de overflow (botão "⋮" + popover) para consolidar ações de uma linha/card e
 * economizar largura no mobile. Fecha ao clicar fora e no Escape.
 * Segue o padrão de popover manual usado no menu do usuário da sidebar (AppLayout).
 */
export function OverflowMenu({
  items,
  ariaLabel = 'Mais ações',
  className = '',
}: {
  items: OverflowMenuItem[]
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={ref} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-border bg-surface-elevated shadow-xl overflow-hidden"
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick() }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap transition-colors disabled:opacity-40 ${
                item.tone === 'danger'
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-text-secondary hover:bg-white/5 hover:text-text'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
