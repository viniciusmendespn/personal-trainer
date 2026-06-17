import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface ConfirmOptions {
  title?: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' para ações destrutivas/irreversíveis (excluir, cancelar) — troca cor e ícone. */
  tone?: 'danger' | 'default'
}

type PendingConfirm = ConfirmOptions & { resolve: (v: boolean) => void }

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }))
  }, [])

  function close(result: boolean) {
    pending?.resolve(result)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!pending} onClose={() => close(false)} title={pending?.title ?? 'Confirmar ação'}>
        {pending && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {pending.tone === 'danger' ? (
                <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              ) : (
                <HelpCircle size={20} className="text-accent-hover shrink-0 mt-0.5" />
              )}
              <div className="text-sm text-text-secondary">{pending.message}</div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                {pending.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button
                type="button"
                variant={pending.tone === 'danger' ? 'danger' : 'primary'}
                onClick={() => close(true)}
                autoFocus
              >
                {pending.confirmLabel ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  )
}

/** Retorna uma função `confirm(opts)` que resolve `true`/`false` — substitui window.confirm
 * por um diálogo com a identidade visual do app, em qualquer operação que precise de
 * confirmação (excluir, cancelar, salvar irreversível etc). */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
