import { useQuery } from '@tanstack/react-query'
import { Check, Copy, Crown, Sparkles, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { divulgadorApi } from '../../api/divulgador'
import { Card } from '../../components/ui'
import { PainelExclusivo } from '../components/PainelExclusivo'
import { BarrasMeses, DivStatCard, TabelaMeses, brl, mesLabel, pct } from '../historico'

const FAIXA_LABEL: Record<string, string> = {
  INICIAL: 'Divulgador Inicial',
  OFICIAL: 'Divulgador Oficial',
  MASTER: 'Divulgador Master',
  EMBAIXADOR: 'Embaixador da Marca',
}

export function PainelPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['div-painel'], queryFn: divulgadorApi.painel })
  const [copiado, setCopiado] = useState(false)

  if (isLoading) return <div className="py-24 text-center text-text-muted text-sm">Carregando seu painel…</div>
  if (error || !data) {
    const code = (error as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
    if (code === 'DIVULGADOR_NAO_CADASTRADO' || (error as { response?: { status?: number } })?.response?.status === 404) {
      return <PainelExclusivo />
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

      {/* Cards do mês corrente */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DivStatCard
          icon={<Wallet size={14} />} label="Comissão do mês"
          value={brl(mesAtual.comissao_valor)}
          sub={`${mesAtual.pagamentos_count} pagamento${mesAtual.pagamentos_count === 1 ? '' : 's'} · ${pct(mesAtual.pct)}${mesAtual.bonus > 0 ? ` · +${brl(mesAtual.bonus)} bônus` : ''}`}
        />
        <DivStatCard
          icon={<Wallet size={14} />} label="A receber"
          value={brl(data.a_receber)}
          sub="Meses fechados aguardando repasse"
        />
        <DivStatCard
          icon={<Check size={14} />} label="Assinantes ativos"
          value={String(data.assinantes_ativos)}
          sub={`${data.assinantes_total} assinantes no total`}
        />
        <DivStatCard
          icon={<TrendingUp size={14} />} label="Contas criadas"
          value={String(data.contas_total)}
          sub="pelo seu cupom"
        />
      </div>

      {/* Período inteiro — visão de lucratividade */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-text flex items-center gap-1.5">
            <Sparkles size={15} className="text-accent" /> Desde que você começou
          </h2>
          <p className="text-xs text-text-muted">
            {data.totais.desde ? `Divulgando desde ${mesLabel(data.totais.desde.slice(0, 7))}` : 'Seu resultado acumulado'}
            {data.totais.meses_ativos > 0 && ` · ${data.totais.meses_ativos} ${data.totais.meses_ativos === 1 ? 'mês' : 'meses'} com vendas`}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <DivStatCard icon={<Wallet size={14} />} label="Total em comissões" value={brl(data.totais.total_comissao)} sub="acumulado no período" />
          <DivStatCard icon={<UserPlus size={14} />} label="Contas ativadas" value={String(data.contas_total)} sub="criadas pelo seu cupom" />
          <DivStatCard icon={<Users size={14} />} label="Assinantes conquistados" value={String(data.assinantes_total)} sub="total que já assinaram" />
        </div>
        <p className="text-[11px] text-text-muted">
          Enquanto seus indicados forem assinantes, você continua recebendo comissão recorrente todo mês.
        </p>
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
      <TabelaMeses meses={data.meses} mesAtualMes={mesAtual.mes} />

      <p className="text-[11px] text-text-muted">
        A comissão incide somente sobre pagamentos confirmados do plano Gestão Pro (add-ons não comissionam).
        O mês em curso fecha no último dia e entra em "a receber". Repasses são feitos via PIX.
        Regras completas em <a href="https://coachpilot.com.br/divulgadores" className="underline">coachpilot.com.br/divulgadores</a>.
      </p>
    </div>
  )
}
