import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Clock, Copy, X } from 'lucide-react'
import { lojaApi, formatPreco, type Pedido } from '../api/loja'
import { Modal, Button, Spinner } from '../components/ui'
import { InstalarActions } from './InstalarActions'

interface Props {
  pedido: Pedido
  onClose: () => void
}

const POLL_MS = 4_000
const TIMEOUT_MS = 31 * 60 * 1_000   // PIX da loja expira em 30 min

/** Checkout PIX da loja — QR + copia-e-cola + polling do pedido (adaptado do PixModal). */
export function CheckoutPixModal({ pedido, onClose }: Props) {
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState(pedido.status)
  const [pix, setPix] = useState(pedido.pix)
  const [expired, setExpired] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  useEffect(() => {
    if (status !== 'AGUARDANDO_PAGAMENTO') return
    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setExpired(true)
    }, TIMEOUT_MS)
    pollRef.current = setInterval(async () => {
      try {
        const p = await lojaApi.getPedido(pedido.pedido_id)
        if (p.pix && !pix?.qr_code_base64) setPix(p.pix)
        if (p.status !== 'AGUARDANDO_PAGAMENTO') {
          stopPolling()
          setStatus(p.status)
          if (p.status === 'EXPIRADO') setExpired(true)
          qc.invalidateQueries({ queryKey: ['loja-compras'] })
        }
      } catch {
        // ignora erros transitórios de polling
      }
    }, POLL_MS)
    return stopPolling
  }, [pedido.pedido_id])   // eslint-disable-line

  async function handleCopy() {
    if (!pix?.qr_code) return
    try {
      await navigator.clipboard.writeText(pix.qr_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_500)
    } catch { /* fallback manual */ }
  }

  if (status === 'ENTREGUE') {
    return (
      <Modal open title="Pagamento confirmado!" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
            <Check size={32} className="text-success" />
          </div>
          <p className="text-sm text-text-secondary text-center">
            Compra de <span className="font-semibold text-text">"{pedido.titulo}"</span> confirmada!
            O pacote já está liberado para você.
          </p>
          <InstalarActions pedidoId={pedido.pedido_id} />
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </Modal>
    )
  }

  if (expired || status === 'EXPIRADO') {
    return (
      <Modal open title="QR Code expirado" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-warning/15 flex items-center justify-center">
            <Clock size={32} className="text-warning" />
          </div>
          <p className="text-sm text-text-secondary text-center">
            O QR Code expirou. Feche e clique em Comprar novamente para gerar um novo.
          </p>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open title="Pagar via Pix" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-text-secondary text-center">
          <span className="font-semibold text-text">{pedido.titulo}</span>
          {' — '}
          <span className="font-semibold text-text">{formatPreco(pedido.preco_centavos)}</span>
        </p>

        {!pix?.qr_code_base64 && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <p className="text-sm text-text-muted">Carregando QR Code…</p>
          </div>
        )}

        {pix?.qr_code_base64 && (
          <>
            <div className="flex justify-center">
              <div className="p-3 rounded-2xl bg-white shadow-sm">
                <img
                  src={`data:image/png;base64,${pix.qr_code_base64}`}
                  alt="QR Code Pix"
                  className="w-52 h-52"
                />
              </div>
            </div>

            {pix.qr_code && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-text-secondary">Pix copia e cola</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg bg-surface px-3 py-2 text-xs text-text-muted font-mono break-all line-clamp-2 border border-border">
                    {pix.qr_code.slice(0, 80)}…
                  </div>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 p-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
                    title="Copiar código"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                {copied && <p className="text-xs text-success text-right">Copiado!</p>}
              </div>
            )}

            <div className="flex items-center gap-2 rounded-xl bg-info/10 px-3 py-2">
              <Spinner className="w-4 h-4 shrink-0" />
              <p className="text-xs text-text-secondary">
                Aguardando confirmação do pagamento… o pacote é liberado na hora. (expira em 30 min)
              </p>
            </div>
          </>
        )}

        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={14} className="mr-1" />
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
