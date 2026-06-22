import { useState } from 'react'
import { Bot, Calendar, Check, CreditCard, MessageCircle, Receipt, Users } from 'lucide-react'
import { Badge, Button, Card } from '../components/ui'
import { PixPaymentModal } from '../components/billing/PixPaymentModal'
import { usePagamentos, usePlanoStatus } from '../hooks/usePlano'

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatValor(valor: number | null) {
  if (valor == null) return 'Concedido'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PlanoPage() {
  const { data, isLoading } = usePlanoStatus()
  const { data: pagamentos } = usePagamentos()
  const [pixOpen, setPixOpen] = useState(false)

  if (isLoading || !data) {
    return <div className="text-sm text-text-secondary">Carregando plano...</div>
  }

  const isPro = data.plano === 'GESTAO_PRO'
  const statusTone = data.status === 'ATIVO' ? 'success' : data.status === 'EXPIRADO' ? 'danger' : 'accent'
  const statusLabel = data.status === 'ATIVO' ? 'Ativo' : data.status === 'EXPIRADO' ? 'Expirado' : 'Trial'

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <Card variant="elevated" className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display text-lg font-bold text-text">
                {isPro ? 'Gestão Pro' : 'Plano Grátis'}
              </h2>
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </div>
            <p className="text-sm text-text-secondary">
              {isPro ? 'Alunos ilimitados e gestão completa.' : 'Até 3 alunos cadastrados, sem custo.'}
            </p>
          </div>
          <CreditCard size={28} className="text-accent shrink-0" />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="flex items-center gap-2 text-sm">
            <Users size={16} className="text-text-muted shrink-0" />
            <span className="text-text-secondary">
              {data.alunos_count}{data.alunos_limit != null ? ` / ${data.alunos_limit}` : ''} alunos
            </span>
          </div>
          {isPro && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={16} className="text-text-muted shrink-0" />
              <span className="text-text-secondary">Válido até {formatDate(data.valida_ate)}</span>
            </div>
          )}
        </div>

        {isPro ? (
          <Button onClick={() => setPixOpen(true)}>Renovar mais um mês</Button>
        ) : (
          <Button onClick={() => setPixOpen(true)}>Assinar Gestão Pro</Button>
        )}
      </Card>

      <Card variant="flat" className="p-6">
        <h3 className="font-display text-sm font-bold text-text mb-1">Add-ons</h3>
        <p className="text-xs text-text-secondary mb-4">
          Canal WhatsApp e Assistente IA são contratados separadamente da gestão.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-text-muted shrink-0" />
              <div>
                <p className="text-sm text-text font-medium">Canal WhatsApp</p>
                <p className="text-xs text-text-muted">
                  {data.addon_whatsapp_ativo ? 'Ativo na sua conta' : 'Em breve — disponível como add-on pago'}
                </p>
              </div>
            </div>
            {data.addon_whatsapp_ativo ? (
              <Badge tone="success"><Check size={11} /> Ativo</Badge>
            ) : (
              <Badge tone="neutral">Em breve</Badge>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-text-muted shrink-0" />
              <div>
                <p className="text-sm text-text font-medium">Assistente IA</p>
                <p className="text-xs text-text-muted">
                  {data.addon_ia_ativo ? 'Ativo na sua conta' : 'Em breve — disponível como add-on pago'}
                </p>
              </div>
            </div>
            {data.addon_ia_ativo ? (
              <Badge tone="success"><Check size={11} /> Ativo</Badge>
            ) : (
              <Badge tone="neutral">Em breve</Badge>
            )}
          </div>
        </div>
      </Card>

      <Card variant="flat" className="p-6">
        <h3 className="font-display text-sm font-bold text-text mb-1">Histórico de pagamentos</h3>
        <p className="text-xs text-text-secondary mb-4">
          Pagamentos do plano Gestão Pro confirmados via Pix.
        </p>
        {!pagamentos || pagamentos.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum pagamento registrado ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pagamentos.map((p) => (
              <div
                key={`${p.processado_em}-${p.payment_id ?? 'admin'}`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface"
              >
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-text-muted shrink-0" />
                  <div>
                    <p className="text-sm text-text font-medium">{formatDateTime(p.processado_em)}</p>
                    <p className="text-xs text-text-muted">
                      {p.dias_concedidos} dias · válido até {formatDate(p.valida_ate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">{formatValor(p.valor)}</span>
                  <Badge tone={p.origem === 'PIX' ? 'success' : 'neutral'}>
                    {p.origem === 'PIX' ? 'Pix' : 'Admin'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <PixPaymentModal open={pixOpen} onClose={() => setPixOpen(false)} />
    </div>
  )
}
