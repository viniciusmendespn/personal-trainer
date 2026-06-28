import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Modal, Button, Spinner, useToast } from '../ui'
import { useCriarPix, useInvalidatePlano, usePixStatus } from '../../hooks/usePlano'

export function PixPaymentModal({ open, onClose, periodo = 'mensal' }: { open: boolean; onClose: () => void; periodo?: 'mensal' | 'anual' }) {
  const criarPix = useCriarPix()
  const invalidatePlano = useInvalidatePlano()
  const { show } = useToast()
  const [copiado, setCopiado] = useState(false)
  const paymentId = criarPix.data?.payment_id
  const pixStatus = usePixStatus(paymentId, open && !!paymentId)
  const aprovado = pixStatus.data?.status === 'approved'
  const aprovadoProcessado = useRef(false)

  useEffect(() => {
    if (open && !criarPix.data && !criarPix.isPending) {
      criarPix.mutate(periodo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) {
      criarPix.reset()
      setCopiado(false)
      aprovadoProcessado.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (aprovado && !aprovadoProcessado.current) {
      aprovadoProcessado.current = true
      invalidatePlano()
      show('Pagamento confirmado! Seu Gestão Pro foi renovado.', 'success')
    }
  }, [aprovado, invalidatePlano, show])

  function copiarCodigo() {
    if (!criarPix.data?.qr_code) return
    navigator.clipboard.writeText(criarPix.data.qr_code)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const title = periodo === 'anual' ? 'Gestão Pro — Pix Anual · R$399,00' : 'Renovar Gestão Pro — Pix'

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {periodo === 'anual' && !aprovado && (
        <p className="text-xs text-text-muted text-center mb-3">Válido por 12 meses · Você economiza R$79,80</p>
      )}
      {criarPix.isPending && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Spinner />
          <p className="text-sm text-text-secondary">Gerando cobrança Pix...</p>
        </div>
      )}

      {criarPix.isError && (
        <div className="py-6 text-center">
          <p className="text-sm text-danger mb-3">Não foi possível gerar o Pix. Tente novamente.</p>
          <Button variant="outline" onClick={() => criarPix.mutate(periodo)}>Tentar de novo</Button>
        </div>
      )}

      {criarPix.data && !aprovado && (
        <div className="flex flex-col items-center gap-4">
          <img
            src={`data:image/png;base64,${criarPix.data.qr_code_base64}`}
            alt="QR Code Pix"
            className="w-56 h-56 rounded-lg border border-border bg-white p-2"
          />
          <p className="text-xs text-text-muted text-center">
            Escaneie o QR Code com o app do seu banco, ou copie o código abaixo.
          </p>
          <button
            onClick={copiarCodigo}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-xs text-text-secondary hover:border-accent transition-colors"
          >
            <span className="truncate font-mono">{criarPix.data.qr_code}</span>
            {copiado ? <Check size={16} className="shrink-0 text-success" /> : <Copy size={16} className="shrink-0" />}
          </button>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Spinner className="w-4 h-4" />
            Aguardando confirmação do pagamento...
          </div>
        </div>
      )}

      {aprovado && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
            <Check size={24} className="text-success" />
          </div>
          <p className="text-sm text-text font-medium">Pagamento confirmado!</p>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      )}
    </Modal>
  )
}
