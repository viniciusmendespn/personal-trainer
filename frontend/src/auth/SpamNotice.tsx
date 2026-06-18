import { Mail } from 'lucide-react'

export function SpamNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5">
      <Mail size={16} className="text-warning shrink-0 mt-0.5" />
      <p className="text-xs text-text-secondary">
        O código quase sempre cai na caixa de <strong className="text-warning">spam</strong> ou{' '}
        <strong className="text-warning">lixo eletrônico</strong> — vale a pena conferir lá antes de pedir um novo.
      </p>
    </div>
  )
}
