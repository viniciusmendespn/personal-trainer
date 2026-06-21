import { useState } from 'react'
import { Modal, Button, Input, Select } from '../ui'
import type { CobrancaConfig, CobrancaConfigIn, Recorrencia } from '../../types'

interface Props {
  current?: CobrancaConfig | null
  onConfirm: (body: CobrancaConfigIn) => Promise<void>
  onClose: () => void
}

export function CobrancaConfigModal({ current, onConfirm, onClose }: Props) {
  const [valor, setValor] = useState(current?.valor?.toString() ?? '')
  const [recorrencia, setRecorrencia] = useState<Recorrencia>(current?.recorrencia ?? 'MENSAL')
  const [diaVencimento, setDiaVencimento] = useState(current?.dia_vencimento?.toString() ?? '10')
  const [diasAntecedencia, setDiasAntecedencia] = useState(current?.dias_antecedencia?.toString() ?? '15')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(valor.replace(',', '.'))
    if (!v || v <= 0) { setError('Informe um valor válido.'); return }
    const dia = parseInt(diaVencimento)
    if (!dia || dia < 1 || dia > 28) { setError('Dia de vencimento deve ser entre 1 e 28.'); return }
    const antec = parseInt(diasAntecedencia)
    if (!antec || antec < 1 || antec > 60) { setError('Antecedência deve ser entre 1 e 60 dias.'); return }
    setLoading(true); setError('')
    try {
      await onConfirm({ valor: v, recorrencia, dia_vencimento: dia, dias_antecedencia: antec, ativo: true })
      onClose()
    } catch {
      setError('Não foi possível salvar a configuração.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={current ? 'Editar faturamento recorrente' : 'Configurar faturamento recorrente'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary">
          Define as cobranças automáticas para este aluno. Cobranças já existentes não são alteradas.
        </p>
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
        <Select
          label="Recorrência"
          value={recorrencia}
          onChange={(e) => setRecorrencia(e.target.value as Recorrencia)}
        >
          <option value="MENSAL">Mensal</option>
          <option value="ANUAL">Anual</option>
        </Select>
        <Input
          label="Dia do vencimento (1–28)"
          type="number"
          min="1"
          max="28"
          value={diaVencimento}
          onChange={(e) => setDiaVencimento(e.target.value)}
          required
        />
        <div>
          <Input
            label="Criar cobrança com antecedência (dias)"
            type="number"
            min="1"
            max="60"
            value={diasAntecedencia}
            onChange={(e) => setDiasAntecedencia(e.target.value)}
          />
          <p className="text-xs text-text-muted mt-1">Quantos dias antes do vencimento a cobrança aparece.</p>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar configuração'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
