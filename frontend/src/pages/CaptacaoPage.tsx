import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, MessageCircle, UserCheck, X, Tag } from 'lucide-react'
import { useLeads, useSetLeadStatus, useConverterLead } from '../hooks/useLeads'
import type { Lead, LeadStatus } from '../api/leads'
import { Card, Spinner, Button, Badge, EmptyState, useToast, useConfirm } from '../components/ui'

const STATUS_LABEL: Record<LeadStatus, string> = {
  NOVO: 'Novo',
  EM_CONTATO: 'Em contato',
  CONVERTIDO: 'Convertido',
  PERDIDO: 'Perdido',
}
const STATUS_TONE: Record<LeadStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  NOVO: 'warning',
  EM_CONTATO: 'info',
  CONVERTIDO: 'success',
  PERDIDO: 'neutral',
}
const ABAS: LeadStatus[] = ['NOVO', 'EM_CONTATO', 'CONVERTIDO', 'PERDIDO']

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

export function CaptacaoPage() {
  const [aba, setAba] = useState<LeadStatus>('NOVO')
  const { data, isLoading } = useLeads()
  const setStatus = useSetLeadStatus()
  const converter = useConverterLead()
  const { show } = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const leads = data?.items ?? []
  const porStatus = data?.por_status ?? {}
  const porFonte = data?.por_fonte ?? {}
  const daAba = leads.filter((l) => l.status === aba)

  async function onConverter(lead: Lead) {
    const ok = await confirm({
      title: 'Converter em aluno',
      message: `Criar o aluno "${lead.nome}" a partir deste lead? Ele passará a contar no limite do seu plano.`,
      confirmLabel: 'Converter',
    })
    if (!ok) return
    try {
      const res = await converter.mutateAsync(lead.ref)
      show(res.ja_existia ? 'Esse telefone já era um aluno — lead marcado como convertido.' : 'Aluno criado com sucesso!', 'success')
      if (res.aluno_id) navigate(`/alunos/${res.aluno_id}`)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { message?: string } | string } } }
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : detail?.message
      show(msg || 'Não foi possível converter o lead.', 'error')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <UserPlus size={20} className="text-accent-hover" />
        <h2 className="font-display text-xl font-semibold">Captação</h2>
      </div>
      <p className="text-sm text-text-secondary mb-4">
        Leads que chegaram pela sua página pública. Configure seu link em{' '}
        <button onClick={() => navigate('/perfil')} className="text-accent-hover hover:underline">Meu Perfil</button>.
      </p>

      {/* Resumo por fonte */}
      {Object.keys(porFonte).length > 0 && (
        <Card className="mb-4">
          <p className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1.5">
            <Tag size={13} /> Leads por fonte
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(porFonte).sort((a, b) => b[1] - a[1]).map(([fonte, n]) => (
              <Badge key={fonte} tone="accent">{fonte}: {n}</Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Abas do funil */}
      <div className="flex gap-2 flex-wrap mb-3">
        {ABAS.map((s) => (
          <button
            key={s}
            onClick={() => setAba(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              aba === s ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:border-accent-hover'
            }`}
          >
            {STATUS_LABEL[s]} {porStatus[s] ? `(${porStatus[s]})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : daAba.length === 0 ? (
        <EmptyState icon={<UserPlus />} title="Nenhum lead aqui" description={`Sem leads em "${STATUS_LABEL[aba]}".`} />
      ) : (
        <div className="space-y-2">
          {daAba.map((lead) => (
            <Card key={lead.ref} variant="elevated">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    {lead.nome}
                    <Badge tone="accent">{lead.fonte}</Badge>
                    <Badge tone={STATUS_TONE[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
                  </p>
                  {lead.objetivos && lead.objetivos.length > 0 && (
                    <p className="text-xs text-text-secondary mt-0.5">Objetivo: {lead.objetivos.join(', ')}</p>
                  )}
                  {lead.mensagem && <p className="text-xs text-text-secondary mt-0.5 italic">"{lead.mensagem}"</p>}
                  <p className="text-[11px] text-text-muted mt-0.5">{lead.telefone} · {tempoRelativo(lead.created_at)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="sm" iconOnly aria-label="Falar no WhatsApp"
                    onClick={() => window.open(`https://wa.me/${lead.telefone}`, '_blank', 'noopener')}>
                    <MessageCircle size={16} />
                  </Button>
                  {lead.status !== 'CONVERTIDO' && (
                    <Button variant="ghost" size="sm" iconOnly aria-label="Converter em aluno"
                      disabled={converter.isPending}
                      onClick={() => onConverter(lead)}>
                      <UserCheck size={16} />
                    </Button>
                  )}
                </div>
              </div>
              {/* Mudança de status do funil */}
              {lead.status !== 'CONVERTIDO' && (
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-border flex-wrap">
                  {(['NOVO', 'EM_CONTATO', 'PERDIDO'] as LeadStatus[])
                    .filter((s) => s !== lead.status)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus.mutate({ ref: lead.ref, status: s })}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-border text-text-secondary hover:border-accent-hover transition-colors inline-flex items-center gap-1"
                      >
                        {s === 'PERDIDO' && <X size={11} />}
                        Marcar {STATUS_LABEL[s].toLowerCase()}
                      </button>
                    ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
