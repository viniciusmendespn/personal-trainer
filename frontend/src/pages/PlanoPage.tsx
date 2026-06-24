import { useState } from 'react'
import { Bot, Calendar, Check, Copy, CreditCard, ExternalLink, Gift, MessageCircle, Receipt, Users } from 'lucide-react'
import { Badge, Button, Card } from '../components/ui'
import { PixPaymentModal } from '../components/billing/PixPaymentModal'
import { FinPilotBenefitCard } from '../components/billing/FinPilotBenefitCard'
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
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

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

      {!isPro && (
        <Card variant="elevated" className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-display text-base font-bold text-text">Por que assinar o Gestão Pro?</h3>
                <span style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Promo Lançamento</span>
              </div>
              <p className="text-xs text-text-secondary">Alunos ilimitados e gestão completa.</p>
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs text-text-muted line-through mb-0.5">De R$69,90/mês</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span style={{ color: '#0d9488', fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: '-1px' }}>R$39,90</span>
              <span className="text-sm text-text-muted">/mês</span>
            </div>
            <p className="text-xs text-text-muted">Preço de lançamento · sem fidelidade · cancele quando quiser</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {[
              'Alunos ilimitados',
              'Treinos e templates ilimitados',
              'Avaliações físicas com evolução',
              'Relatórios de desempenho',
              'Suporte prioritário',
              'Sem fidelidade',
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-sm">
                <Check size={14} className="text-accent shrink-0" />
                <span className="text-text-secondary">{benefit}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            <div className="flex items-start gap-2">
              <img src="https://djkvxxf33pska.cloudfront.net/pwa-64x64.png" alt="FinPilot" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-sm font-semibold text-text mb-0.5">Bônus FinPilot incluso</p>
                <p className="text-xs text-text-muted leading-relaxed">A cada mês pago, você ganha 1 mês grátis no FinPilot — gerenciador financeiro pessoal com planilha inteligente e IA em português.</p>
              </div>
            </div>
          </div>

          <Button onClick={() => setPixOpen(true)}>Assinar Gestão Pro — R$39,90/mês</Button>
        </Card>
      )}

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

      {isPro && <FinPilotBenefitCard />}

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
              <div key={`${p.processado_em}-${p.payment_id ?? 'admin'}`} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface">
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
                {p.finpilot_code && (
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-surface-secondary">
                    <div className="flex items-center gap-2 min-w-0">
                      <Gift size={15} className="text-accent shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text">1 mês grátis no FinPilot</p>
                        <p className="text-xs text-text-muted font-mono truncate">{p.finpilot_code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href="https://finpilot.ia.br"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-surface transition-colors text-text-muted hover:text-text"
                        title="Abrir FinPilot"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        onClick={() => copyCode(p.finpilot_code!)}
                        className="p-1.5 rounded hover:bg-surface transition-colors text-text-muted hover:text-text"
                        title="Copiar código"
                      >
                        {copiedCode === p.finpilot_code ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <PixPaymentModal open={pixOpen} onClose={() => setPixOpen(false)} />
    </div>
  )
}
