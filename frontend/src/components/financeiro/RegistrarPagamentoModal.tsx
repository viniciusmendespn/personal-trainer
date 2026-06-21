import { useState } from 'react'
import { Modal, Button, Input } from '../ui'
import type { Cobranca, RegistrarPagamentoIn } from '../../types'

interface Props {
  cobranca: Cobranca
  onConfirm: (body: RegistrarPagamentoIn) => Promise<void>
  onClose: () => void
}

export function RegistrarPagamentoModal({ cobranca, onConfirm, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [dataPagamento, setDataPagamento] = useState(today)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dataPagamento) { setError('Informe a data de pagamento.'); return }
    setLoading(true); setError('')
    try {
      await onConfirm({ data_pagamento: dataPagamento, notas: notas || undefined, forma_pagamento: 'MANUAL' })
      onClose()
    } catch {
      setError('Não foi possível registrar o pagamento.')
    } finally {
      setLoading(false)
    }
  }

  const valor = cobranca.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <Modal title="Registrar pagamento" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary">
          Cobrança de <span className="font-semibold text-text">{valor}</span> — vencimento em{' '}
          {cobranca.vencimento.split('-').reverse().join('/')}.
        </p>
        <Input
          label="Data do pagamento"
          type="date"
          value={dataPagamento}
          onChange={(e) => setDataPagamento(e.target.value)}
          required
        />
        <Input
          label="Observações (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ex.: pago via transferência"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={loading || !dataPagamento}>
            {loading ? 'Salvando…' : 'Confirmar pagamento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
