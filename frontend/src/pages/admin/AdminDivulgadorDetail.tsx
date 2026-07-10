import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Copy, UserPlus, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { adminApi, type DivulgadorAdmin } from '../../api/admin'
import { Card, useToast } from '../../components/ui'
import { BarrasMeses, DivStatCard, TabelaMeses, brl, mesLabel, pct } from '../../divulgador/historico'

function dataBr(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

/** Duração do cupom em texto amigável: "60 dias · 2 meses" quando múltiplo exato de 30. */
function duracaoCupom(dias: number | null): string {
  const d = dias ?? 30   // cupons antigos não têm o campo — sempre foram 30 dias
  if (d % 30 === 0) {
    const m = d / 30
    return `${d} dias · ${m} ${m === 1 ? 'mês' : 'meses'}`
  }
  return `${d} dias`
}

export function AdminDivulgadorDetail({ d, onBack, onRepasse }: {
  d: DivulgadorAdmin
  onBack: () => void
  onRepasse: (d: DivulgadorAdmin) => void
}) {
  const painel = useQuery({
    queryKey: ['admin-div-painel', d.divulgador_id],
    queryFn: () => adminApi.divulgadorPainel(d.divulgador_id),
  })
  const clientes = useQuery({
    queryKey: ['admin-div-clientes', d.divulgador_id],
    queryFn: () => adminApi.divulgadorClientes(d.divulgador_id),
  })

  const queryClient = useQueryClient()
  const toast = useToast()
  const faixaMut = useMutation({
    mutationFn: (faixa_manual: string) => adminApi.atualizarDivulgador(d.divulgador_id, { faixa_manual }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-div-painel', d.divulgador_id] })
      queryClient.invalidateQueries({ queryKey: ['admin-divulgadores'] })
      toast.show('Faixa atualizada.', 'success')
    },
    onError: () => toast.show('Não foi possível atualizar a faixa.', 'error'),
  })

  const p = painel.data

  const linkCupom = `https://coachpilot.com.br/signup?cupom=${d.codigo}`
  const [copiado, setCopiado] = useState(false)
  async function copiarLink() {
    await navigator.clipboard.writeText(linkCupom)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors">
        <ArrowLeft size={15} /> Voltar aos divulgadores
      </button>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold flex items-center gap-2 flex-wrap">
            {d.nome || '(sem nome)'}
            {d.embaixador && <span className="text-[10px] text-accent font-semibold">EMB</span>}
            {!d.ativo && <span className="text-[10px] text-red-400 font-semibold">INATIVO</span>}
          </h2>
          <p className="text-xs text-text-muted break-all">
            {d.email} · cupom <span className="font-mono text-text-secondary">{d.codigo}</span>
            {' '}· grátis por <span className="text-text-secondary">{duracaoCupom(d.cupom_dias)}</span>
            {d.pix_key ? <> · PIX <span className="text-text-secondary">{d.pix_key}</span></> : ''}
          </p>
        </div>
        <button
          onClick={() => onRepasse(d)}
          title="Marcar repasse do mês anterior como pago"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-elevated transition-colors shrink-0"
        >
          <Check size={12} /> Marcar repasse
        </button>
      </div>

      {/* Cupom e link de indicação — copiável */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">Cupom e link de indicação</p>
            <p className="text-lg font-bold text-accent">{d.codigo}</p>
            <p className="text-xs text-text-muted break-all">{linkCupom}</p>
          </div>
          <button
            onClick={copiarLink}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shrink-0"
          >
            {copiado ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar link</>}
          </button>
        </div>
      </Card>

      {painel.isLoading && <p className="text-sm text-text-muted">Carregando painel…</p>}
      {painel.error && <p className="text-sm text-red-400">Erro ao carregar o painel deste divulgador.</p>}

      {p && (
        <>
          {/* Agregadores de período inteiro */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <DivStatCard
              icon={<Wallet size={14} />} label="Total em comissões"
              value={brl(p.totais.total_comissao)}
              sub={p.totais.desde ? `desde ${mesLabel(p.totais.desde.slice(0, 7))} · ${p.totais.meses_ativos} ${p.totais.meses_ativos === 1 ? 'mês' : 'meses'}` : 'acumulado'}
            />
            <DivStatCard
              icon={<Wallet size={14} />} label="A receber"
              value={brl(p.a_receber)} sub="meses fechados"
            />
            <DivStatCard
              icon={<UserPlus size={14} />} label="Contas ativadas"
              value={String(p.contas_total)} sub="pelo cupom"
            />
            <DivStatCard
              icon={<Users size={14} />} label="Assinantes"
              value={`${p.assinantes_ativos} / ${p.assinantes_total}`} sub="ativos / total"
            />
          </div>

          <p className="text-sm text-text-secondary">
            Faixa <span className="font-semibold text-text">{p.faixa}</span> · comissão vigente{' '}
            <span className="font-semibold text-accent">{pct(p.mes_atual.pct)}</span> · mês corrente{' '}
            <span className="font-semibold text-text">{brl(p.mes_atual.comissao_valor)}</span>
          </p>

          {/* Faixa manual — override do automático por carteira */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">Faixa de comissão</label>
            <select
              value={p.faixa_manual ?? 'AUTO'}
              onChange={(e) => faixaMut.mutate(e.target.value)}
              disabled={faixaMut.isPending}
              className="px-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            >
              <option value="AUTO">Automática (por carteira)</option>
              <option value="INICIAL">Inicial (20%)</option>
              <option value="OFICIAL">Oficial (25%)</option>
              <option value="MASTER">Master (30%)</option>
              <option value="EMBAIXADOR">Embaixador (30–35%)</option>
            </select>
            {p.faixa_manual && <span className="text-[11px] font-semibold text-amber-400">override manual</span>}
            {faixaMut.isPending && <span className="text-xs text-text-muted">salvando…</span>}
          </div>

          {/* Gráfico 6 meses */}
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-4">Comissões — últimos 6 meses</p>
            <BarrasMeses meses={p.meses} />
          </Card>

          {/* Tabela mensal */}
          <TabelaMeses meses={p.meses} mesAtualMes={p.mes_atual.mes} />
        </>
      )}

      {/* Carteira de indicados */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-1.5"><Users size={15} /> Carteira de indicados</h3>
        {clientes.isLoading ? (
          <p className="text-sm text-text-muted">Carregando…</p>
        ) : clientes.data && clientes.data.length > 0 ? (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide">
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3 text-center">Situação</th>
                    <th className="px-4 py-3 text-center">Entrou em</th>
                    <th className="px-4 py-3 text-center">1º pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.data.map((c, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 font-medium">{c.nome}</td>
                      <td className="px-4 py-3 text-center">
                        {c.status === 'ASSINANTE' && c.ativo ? (
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">Assinante ativo</span>
                        ) : c.status === 'ASSINANTE' ? (
                          <span className="rounded-md bg-slate-500/15 px-2 py-0.5 text-[11px] font-semibold text-slate-400">Assinatura vencida</span>
                        ) : (
                          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">Ainda não assinou</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-text-secondary">{dataBr(c.desde)}</td>
                      <td className="px-4 py-3 text-center text-text-secondary">{dataBr(c.primeiro_pgto_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-center text-sm text-text-secondary">Nenhuma conta criada com este cupom ainda.</Card>
        )}
      </div>
    </div>
  )
}
