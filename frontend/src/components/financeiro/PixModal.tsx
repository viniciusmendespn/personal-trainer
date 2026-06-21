import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Copy, Check, Clock, X } from 'lucide-react'
import { alunoFinanceiroApi } from '../../api/financeiro'
import type { Cobranca } from '../../types'
import { Modal, Button, Spinner } from '../ui'

interface Props {
  cobranca: Cobranca
  onClose: () => void
}

const POLL_MS = 4_000
const TIMEOUT_MS = 10 * 60 * 1_000   // 10 minutos

export function PixModal({ cobranca, onClose }: Props) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [qrBase64, setQrBase64] = useState('')
  const [copied, setCopied] = useState(false)
  const [paid, setPaid] = useState(false)
  const [expired, setExpired] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  useEffect(() => {
    let cancelled = false
    async function generate() {
      setLoading(true)
      setError('')
      try {
        const data = await alunoFinanceiroApi.criarPix(cobranca.cobranca_id)
        if (cancelled) return
        setQrCode(data.qr_code ?? '')
        setQrBase64(data.qr_code_base64 ?? '')
        setLoading(false)
        startPolling(data.payment_id)
      } catch {
        if (!cancelled) {
          setError('Não foi possível gerar o QR Code. Verifique a conexão e tente novamente.')
          setLoading(false)
        }
      }
    }
    generate()
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [cobranca.cobranca_id])   // eslint-disable-line

  function startPolling(pid: string) {
    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setExpired(true)
    }, TIMEOUT_MS)

    pollRef.current = setInterval(async () => {
      try {
        const s = await alunoFinanceiroApi.getPixStatus(pid)
        if (s.status === 'approved') {
          stopPolling()
          setPaid(true)
          qc.invalidateQueries({ queryKey: ['aluno-financeiro'] })
        } else if (s.status === 'rejected' || s.status === 'cancelled') {
          stopPolling()
          setError('Pagamento recusado ou cancelado. Gere um novo QR Code.')
        }
      } catch {
        // ignora erros transitórios de polling
      }
    }, POLL_MS)
  }

  async function handleCopy() {
    if (!qrCode) return
    try {
      await navigator.clipboard.writeText(qrCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_500)
    } catch {
      // fallback: seleciona o texto manualmente
    }
  }

  const valor = cobranca.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (paid) {
    return (
      <Modal open title="Pagamento confirmado!" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
            <Check size={32} className="text-success" />
          </div>
          <p className="text-sm text-text-secondary text-center">
            Seu pagamento de <span className="font-semibold text-text">{valor}</span> foi confirmado!
          </p>
          <Button variant="primary" onClick={onClose}>Fechar</Button>
        </div>
      </Modal>
    )
  }

  if (expired) {
    return (
      <Modal open title="QR Code expirado" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-warning/15 flex items-center justify-center">
            <Clock size={32} className="text-warning" />
          </div>
          <p className="text-sm text-text-secondary text-center">
            O QR Code expirou. Feche e tente novamente para gerar um novo.
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
          Cobrança de <span className="font-semibold text-text">{valor}</span>
        </p>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <p className="text-sm text-text-muted">Gerando QR Code…</p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl bg-danger/10 p-3 text-sm text-danger text-center">
            {error}
          </div>
        )}

        {!loading && !error && qrBase64 && (
          <>
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="p-3 rounded-2xl bg-white shadow-sm">
                <img
                  src={`data:image/png;base64,${qrBase64}`}
                  alt="QR Code Pix"
                  className="w-52 h-52"
                />
              </div>
            </div>

            {/* Copia e cola */}
            {qrCode && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-text-secondary">Pix copia e cola</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg bg-surface px-3 py-2 text-xs text-text-muted font-mono break-all line-clamp-2 border border-border">
                    {qrCode.slice(0, 80)}…
                  </div>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 p-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
                    title="Copiar código"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-success text-right">Copiado!</p>
                )}
              </div>
            )}

            {/* Aguardando */}
            <div className="flex items-center gap-2 rounded-xl bg-info/10 px-3 py-2">
              <Spinner className="w-4 h-4 shrink-0" />
              <p className="text-xs text-text-secondary">
                Aguardando confirmação do pagamento… (expira em 10 min)
              </p>
            </div>
          </>
        )}

        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={14} className="mr-1" />
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
