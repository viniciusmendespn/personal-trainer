import { useQuery } from '@tanstack/react-query'
import { Check, Copy, Crown, Rocket, TrendingUp, Wallet } from 'lucide-react'
import { useState } from 'react'
import { divulgadorApi, type MesComissao } from '../../api/divulgador'
import { Card } from '../../components/ui'

const FAIXA_LABEL: Record<string, string> = {
  INICIAL: 'Divulgador Inicial',
  OFICIAL: 'Divulgador Oficial',
  MASTER: 'Divulgador Master',
  EMBAIXADOR: 'Embaixador da Marca',
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

function mesLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[parseInt(m, 10) - 1]}/${y.slice(2)}`
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-text-muted text-xs font-semibold uppercase tracking-wide mb-2">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold text-text">{value}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </Card>
  )
}

function BarrasMeses({ meses }: { meses: MesComissao[] }) {
  const max = Math.max(...meses.map(m => m.comissao_valor), 1)
  return (
    <div className="flex items-end gap-2 h-36">
      {meses.map(m => (
        <div key={m.mes} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[10px] text-text-secondary font-medium truncate max-w-full">
            {m.comissao_valor > 0 ? brl(m.comissao_valor) : ''}
          </span>
          <div
            className="w-full rounded-t-md loja-gradient transition-all"
            style={{ height: `${Math.max((m.comissao_valor / max) * 100, m.comissao_valor > 0 ? 6 : 2)}%`, opacity: m.comissao_valor > 0 ? 1 : 0.15 }}
            title={`${mesLabel(m.mes)}: ${brl(m.comissao_valor)}`}
          />
          <span className="text-[10px] text-text-muted">{mesLabel(m.mes)}</span>
        </div>
      ))}
    </div>
  )
}

function NaoCadastrado() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Rocket size={40} className="mx-auto text-accent mb-4" />
      <h1 className="text-xl font-bold mb-2">Você ainda não é divulgador</h1>
      <p className="text-sm text-text-secondary mb-6">
        O programa de divulgadores CoachPilot paga comissão recorrente sobre cada assinatura
        Gestão Pro que você indicar. A entrada é feita pela nossa equipe.
      </p>
      <a
        href="https://wa.me/5513991830305?text=Oi%2C%20quero%20entrar%20no%20programa%20de%20divulgadores%20do%20CoachPilot"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
      >
        Quero ser divulgador
      </a>
      <p className="text-xs text-text-muted mt-4">
        <a href="https://coachpilot.com.br/divulgadores" className="hover:underline">Conheça as regras do programa</a>
      </p>
    </div>
  )
}

export function PainelPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['div-painel'], queryFn: divulgadorApi.painel })
  const [copiado, setCopiado] = useState(false)

  if (isLoading) return <div className="py-24 text-center text-text-muted text-sm">Carregando seu painel…</div>
  if (error || !data) {
    const code = (error as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
    if (code === 'DIVULGADOR_NAO_CADASTRADO' || (error as { response?: { status?: number } })?.response?.status === 404) {
      return <NaoCadastrado />
    }
    return <div className="py-24 text-center text-text-muted text-sm">Não foi possível carregar o painel. Tente novamente.</div>
  }

  const linkCupom = `https://coachpilot.com.br/signup?cupom=${data.cupom_codigo}`
  const mesAtual = data.mes_atual

  async function copiar() {
    await navigator.clipboard.writeText(linkCupom)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Cabeçalho: faixa + acelerador */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{FAIXA_LABEL[data.faixa] || data.faixa}</h1>
            {data.fundador && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                <Crown size={12} /> Fundador
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary mt-0.5">
            Comissão vigente: <span className="font-semibold text-accent">{pct(mesAtual.pct)}</span> neste mês
            {' '}(base {pct(data.pct_base)})
          </p>
        </div>
        <Card className={`px-4 py-3 ${data.acelerador.ativo ? 'border-accent/40' : ''}`}>
          {data.acelerador.ativo ? (
            <p className="text-sm font-semibold text-accent flex items-center gap-1.5">
              <TrendingUp size={15} /> Acelerador ativo: +5% em todo o mês 🎉
            </p>
          ) : (
            <p className="text-sm text-text-secondary flex items-center gap-1.5">
              <TrendingUp size={15} className="text-text-muted" />
              {data.acelerador.vendas_para_ativar === 1 ? 'Falta 1 venda' : `Faltam ${data.acelerador.vendas_para_ativar} vendas`} para ativar +5% este mês
            </p>
          )}
        </Card>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Wallet size={14} />} label="Comissão do mês"
          value={brl(mesAtual.comissao_valor)}
          sub={`${mesAtual.pagamentos_count} pagamento${mesAtual.pagamentos_count === 1 ? '' : 's'} · ${pct(mesAtual.pct)}${mesAtual.bonus > 0 ? ` · +${brl(mesAtual.bonus)} bônus` : ''}`}
        />
        <StatCard
          icon={<Wallet size={14} />} label="A receber"
          value={brl(data.a_receber)}
          sub="Meses fechados aguardando repasse"
        />
        <StatCard
          icon={<Check size={14} />} label="Assinantes ativos"
          value={String(data.assinantes_ativos)}
          sub={`${data.assinantes_total} assinantes no total`}
        />
        <StatCard
          icon={<TrendingUp size={14} />} label="Contas criadas"
          value={String(data.contas_total)}
          sub="pelo seu cupom"
        />
      </div>

      {/* Seu cupom */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">Seu cupom</p>
            <p className="text-lg font-bold text-accent">{data.cupom_codigo}</p>
            <p className="text-xs text-text-muted break-all">{linkCupom}</p>
          </div>
          <button
            onClick={copiar}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shrink-0"
          >
            {copiado ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar link</>}
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">
          Quem assina pelo seu link ganha 30 dias grátis — e você ganha comissão recorrente enquanto ele for assinante.
        </p>
      </Card>

      {/* Gráfico 6 meses */}
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-4">Comissões — últimos 6 meses</p>
        <BarrasMeses meses={data.meses} />
      </Card>

      {/* Tabela mensal */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide">
                <th className="px-4 py-3">Mês</th>
                <th className="px-4 py-3 text-right">Base (Gestão Pro)</th>
                <th className="px-4 py-3 text-center">Vendas novas</th>
                <th className="px-4 py-3 text-center">%</th>
                <th className="px-4 py-3 text-right">Comissão</th>
                <th className="px-4 py-3 text-center">Repasse</th>
              </tr>
            </thead>
            <tbody>
              {[...data.meses].reverse().map(m => (
                <tr key={m.mes} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 font-medium">{mesLabel(m.mes)}{m.mes === mesAtual.mes && <span className="ml-1.5 text-[10px] text-accent">(em curso)</span>}</td>
                  <td className="px-4 py-3 text-right">{brl(m.base_valor)}</td>
                  <td className="px-4 py-3 text-center">{m.vendas_novas}</td>
                  <td className="px-4 py-3 text-center">{pct(m.pct)}{m.bonus > 0 && <span className="text-[10px] text-accent"> +{brl(m.bonus)}</span>}</td>
                  <td className="px-4 py-3 text-right font-semibold">{brl(m.comissao_valor)}</td>
                  <td className="px-4 py-3 text-center">
                    {m.comissao_valor <= 0 ? (
                      <span className="text-text-muted text-xs">—</span>
                    ) : m.mes === mesAtual.mes ? (
                      <span className="text-xs text-text-muted">em curso</span>
                    ) : m.repasse_status === 'PAGO' ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        <Check size={11} /> Pago
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">A receber</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[11px] text-text-muted">
        A comissão incide somente sobre pagamentos confirmados do plano Gestão Pro (add-ons não comissionam).
        O mês em curso fecha no último dia e entra em "a receber". Repasses são feitos via PIX.
        Regras completas em <a href="https://coachpilot.com.br/divulgadores" className="underline">coachpilot.com.br/divulgadores</a>.
      </p>
    </div>
  )
}
