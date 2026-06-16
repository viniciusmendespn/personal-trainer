import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  title,
  children,
  className = '',
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full sm:max-w-lg sm:mx-4 max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface-elevated border border-border shadow-[var(--shadow-card)] p-5 ${className}`}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border-strong sm:hidden" />
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="p-1.5 rounded-lg text-text-secondary hover:bg-white/5 hover:text-text"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
