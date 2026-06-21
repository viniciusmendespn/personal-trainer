import { useState } from 'react'
import { Modal, Button, Input, Select } from '../ui'
import type { NovaCobrancaIn, Recorrencia } from '../../types'

interface Props {
  onConfirm: (body: NovaCobrancaIn) => Promise<void>
  onClose: () => void
}

export function NovaCobrancaModal({ onConfirm, onClose }: Props) {
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [recorrencia, setRecorrencia] = useState<Recorrencia>('MENSAL')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(valor.replace(',', '.'))
    if (!v || v <= 0) { setError('Informe um valor válido.'); return }
    if (!vencimento) { setError('Informe a data de vencimento.'); return }
    setLoading(true); setError('')
    try {
      await onConfirm({ valor: v, vencimento, recorrencia, notas: notas || undefined })
      onClose()
    } catch {
      setError('Não foi possível criar a cobrança.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open title="Nova cobrança" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Valor (R$)"
          type="number"
          min="0.01"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          required
        />
        <Input
          label="Data de vencimento"
          type="date"
          value={vencimento}
          onChange={(e) => setVencimento(e.target.value)}
          required
        />
        <Select
          label="Recorrência"
          value={recorrencia}
          onChange={(e) => setRecorrencia(e.target.value as Recorrencia)}
        >
          <option value="MENSAL">Mensal</option>
          <option value="ANUAL">Anual</option>
        </Select>
        <Input
          label="Observações (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ex.: mensalidade extra"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Criando…' : 'Criar cobrança'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
