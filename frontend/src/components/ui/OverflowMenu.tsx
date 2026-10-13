import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
 *
 * O popover é renderizado em portal no <body> com `position: fixed`: um ancestral com
 * `opacity < 1` (ex.: card de treino vencido) ou `overflow: hidden` cria stacking context /
 * recorte, e o menu ficaria translúcido e coberto pelo card seguinte, sem receber clique.
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
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !ref.current) { setPos(null); return }
    const r = ref.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    // Posição é fixa na viewport — rolar/redimensionar descolaria o menu do botão.
    function close() { setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
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
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-50 min-w-[10rem] rounded-lg border border-border bg-surface-elevated shadow-xl overflow-hidden"
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
        </div>,
        document.body,
      )}
    </div>
  )
}
