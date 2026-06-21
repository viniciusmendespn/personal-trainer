import { CheckCircle, Clock, AlertTriangle, DollarSign } from 'lucide-react'
import type { Cobranca } from '../../types'
import { Badge, Button } from '../ui'

const STATUS_CONFIG = {
  PENDENTE: { label: 'Pendente', tone: 'warning' as const, icon: Clock },
  PAGA:     { label: 'Paga',     tone: 'success' as const, icon: CheckCircle },
  VENCIDA:  { label: 'Vencida',  tone: 'danger'  as const, icon: AlertTriangle },
}

const RECORRENCIA_LABEL = { MENSAL: 'Mensal', ANUAL: 'Anual' }

function fmtData(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtValor(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  cobranca: Cobranca
  onPagar?: (c: Cobranca) => void
  onCancelar?: (c: Cobranca) => void
}

export function CobrancaCard({ cobranca: c, onPagar, onCancelar }: Props) {
  const cfg = STATUS_CONFIG[c.status]
  const Icon = cfg.icon

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-surface">
      <div className="mt-0.5">
        <Icon size={18} className={c.status === 'PAGA' ? 'text-success' : c.status === 'VENCIDA' ? 'text-danger' : 'text-warning'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-text">{fmtValor(c.valor)}</span>
          <Badge tone={cfg.tone}>{cfg.label}</Badge>
          <span className="text-xs text-text-muted">{RECORRENCIA_LABEL[c.recorrencia]}</span>
        </div>
        <div className="mt-1 text-xs text-text-secondary space-y-0.5">
          <p>Vencimento: <span className="text-text">{fmtData(c.vencimento)}</span></p>
          {c.status === 'PAGA' && (
            <p>Pago em: <span className="text-text">{fmtData(c.data_pagamento)}</span>
              {c.forma_pagamento && <span className="ml-1 text-text-muted">· {c.forma_pagamento === 'PIX_MP' ? 'Pix' : 'Manual'}</span>}
            </p>
          )}
          {c.notas && <p className="text-text-muted italic">{c.notas}</p>}
        </div>
      </div>
      {(c.status === 'PENDENTE' || c.status === 'VENCIDA') && (
        <div className="flex flex-col sm:flex-row gap-1 shrink-0">
          {onPagar && (
            <Button size="sm" variant="primary" className="gap-1 text-xs" onClick={() => onPagar(c)}>
              <DollarSign size={13} /> Pagar
            </Button>
          )}
          {onCancelar && c.status === 'PENDENTE' && (
            <Button size="sm" variant="ghost" className="text-xs text-text-muted" onClick={() => onCancelar(c)}>
              Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
