import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import {
  DollarSign, Clock, AlertTriangle, Repeat, Wallet, QrCode, ChevronLeft, ChevronRight,
  CheckCircle, Receipt, Info,
} from 'lucide-react'
import { useFinanceiroResumo, useRecebiveis, usePagamentosRecentes } from '../hooks/useFinanceiro'
import { financeiroApi, type CobrancaComAluno } from '../api/financeiro'
import type { Cobranca } from '../types'
import {
  Card, StatCard, Tabs, Badge, Button, Spinner, EmptyState, Skeleton, SkeletonLine, useToast,
} from '../components/ui'
import { RegistrarPagamentoModal } from '../components/financeiro/RegistrarPagamentoModal'
import { formatBRL } from '../utils/currency'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: '#e2e8f0',
  fontSize: 12,
}
const chartTipItem = { color: '#e2e8f0' }
const chartTipLabel = { color: '#94a3b8' }
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 11 }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function ymOffset(base: Date, back: number) {
  const d = new Date(base.getFullYear(), base.getMonth() - back, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function labelMesLongo(ym: string) {
  const [y, m] = ym.split('-')
  return `${MESES_LONGO[Number(m) - 1]} ${y}`
}
function fmtData(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function diasAtraso(vencimento?: string): number | null {
  if (!vencimento) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const v = new Date(vencimento + 'T00:00:00')
  const diff = Math.round((hoje.getTime() - v.getTime()) / 86_400_000)
  return diff > 0 ? diff : null
}

type FiltroReceb = 'TODOS' | 'PENDENTE' | 'VENCIDA'

export function FinanceiroPanelPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const [mesBack, setMesBack] = useState(0)
  const mes = useMemo(() => ymOffset(new Date(), mesBack), [mesBack])
  const [filtro, setFiltro] = useState<FiltroReceb>('TODOS')
  const [pagando, setPagando] = useState<CobrancaComAluno | null>(null)

  const { data: resumo, isLoading } = useFinanceiroResumo(mes)
  const { data: recebiveis, isLoading: loadingReceb } = useRecebiveis(
    filtro === 'TODOS' ? undefined : filtro,
  )
  const { data: pagamentos, isLoading: loadingPag } = usePagamentosRecentes(15)

  const mpNaoConfigurado = resumo !== undefined && !resumo.mp_configurado

  async function registrarPagamento(c: CobrancaComAluno, body: Parameters<typeof financeiroApi.registrarPagamento>[2]) {
    await financeiroApi.registrarPagamento(c.aluno_id, c.cobranca_id, body)
    qc.invalidateQueries({ queryKey: ['financeiro-resumo'] })
    qc.invalidateQueries({ queryKey: ['financeiro-recebiveis'] })
    qc.invalidateQueries({ queryKey: ['financeiro-pagamentos'] })
    qc.invalidateQueries({ queryKey: ['cobranças', c.aluno_id] })
    show('Pagamento registrado.', 'success')
  }

  const chartData = (resumo?.historico ?? []).map((h) => ({
    ...h,
    label: MESES[Number(h.mes.split('-')[1]) - 1],
  }))
  const maxReceb = Math.max(...chartData.map((d) => d.recebido), 1)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display text-xl font-semibold">Painel financeiro</h2>
        {/* Navegação de mês (afeta "Recebido no mês") */}
        <div className="flex items-center gap-1 text-sm">
          <button
            aria-label="Mês anterior"
            onClick={() => setMesBack((m) => m + 1)}
            className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-secondary"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[110px] text-center font-medium capitalize">{labelMesLongo(mes)}</span>
          <button
            aria-label="Próximo mês"
            onClick={() => setMesBack((m) => Math.max(0, m - 1))}
            disabled={mesBack === 0}
            className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-secondary disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Banner Mercado Pago */}
      {mpNaoConfigurado && (
        <div className="banner-pix-mp rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 items-start">
          <div className="mt-0.5 rounded-lg bg-amber-100 p-2 shrink-0">
            <QrCode size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Ative o PIX automático via Mercado Pago</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Gere QR Code PIX e confirme pagamentos automaticamente — sem registrar manualmente.
            </p>
          </div>
          <Link
            to="/config?tab=pagamentos"
            className="shrink-0 self-center text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors whitespace-nowrap"
          >
            Configurar agora
          </Link>
        </div>
      )}

      {/* ── KPIs ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} variant="elevated" className="flex items-start gap-3">
              <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1">
                <SkeletonLine width="w-16" />
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      ) : resumo ? (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${resumo.mp_liquido != null ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3`}>
          <StatCard
            icon={<DollarSign />}
            label="Recebido no mês"
            value={formatBRL(resumo.recebido_valor)}
            hint={`${resumo.pago_count} pagamento${resumo.pago_count === 1 ? '' : 's'}`}
            tone="success"
            className="h-full"
            valueClassName="text-xl"
          />
          <StatCard
            icon={<Clock />}
            label="A receber"
            value={formatBRL(resumo.a_receber_valor)}
            hint={`${resumo.pendente_count} pendente${resumo.pendente_count === 1 ? '' : 's'}`}
            tone="warning"
            className="h-full"
            valueClassName="text-xl"
          />
          <StatCard
            icon={<AlertTriangle />}
            label="Vencido"
            value={formatBRL(resumo.vencido_valor)}
            hint={`${resumo.vencido_count} em atraso`}
            tone="danger"
            className="h-full"
            valueClassName="text-xl"
          />
          <StatCard
            icon={<Repeat />}
            label="Receita recorrente"
            value={formatBRL(resumo.mrr)}
            hint="mensalidades ativas / mês"
            tone="accent"
            className="h-full"
            valueClassName="text-xl"
          />
          {resumo.mp_configurado && resumo.mp_liquido != null && (
            <>
              <StatCard
                icon={<Wallet />}
                label="Líquido recebido"
                value={formatBRL(resumo.mp_liquido)}
                hint="após taxas do Mercado Pago"
                tone="success"
                className="h-full"
                valueClassName="text-xl"
              />
              <StatCard
                icon={<Receipt />}
                label="Taxas do mês"
                value={formatBRL(resumo.mp_taxa)}
                hint="pagas ao Mercado Pago"
                tone="accent"
                className="h-full"
                valueClassName="text-xl"
              />
            </>
          )}
        </div>
      ) : null}

      {/* Aviso de taxas — quando o MP está ativo mas não temos a taxa exata de todos
          os Pix do mês. Preferimos informar a existência da taxa a exibir um líquido
          calculado que poderia enganar (ex.: mostrar R$ 150 e cair R$ 148 na conta). */}
      {resumo && resumo.mp_configurado && resumo.mp_liquido == null && (
        <div className="rounded-xl border border-border bg-surface-elevated px-4 py-3 flex gap-3 items-start">
          <div className="mt-0.5 rounded-lg bg-accent/10 p-2 shrink-0">
            <Info size={16} className="text-accent" />
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Os valores acima são <span className="font-medium text-text">brutos</span>. O Mercado Pago
            desconta uma taxa por transação recebida via Pix, então o valor creditado na sua conta é um
            pouco menor. O líquido exato aparece aqui assim que o Mercado Pago informa a taxa de cada pagamento.
          </p>
        </div>
      )}

      {/* ── Gráfico 12 meses ── */}
      <Card variant="elevated" className="flex flex-col">
        <p className="text-xs font-medium text-text-secondary mb-3">Faturamento recebido — últimos 12 meses</p>
        {chartData.some((d) => d.recebido > 0) ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={18} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={chartTip}
                itemStyle={chartTipItem}
                labelStyle={chartTipLabel}
                formatter={(v: number) => [formatBRL(v), 'Recebido']}
              />
              <Bar dataKey="recebido" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.recebido > 0 ? 'var(--color-success)' : 'rgba(255,255,255,0.06)'}
                    opacity={entry.recebido > 0 ? 0.4 + (entry.recebido / maxReceb) * 0.6 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center text-xs text-text-muted py-8">
            Nenhum pagamento recebido nos últimos 12 meses
          </div>
        )}
      </Card>

      {/* ── Recebíveis ── */}
      <Card variant="elevated" className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold text-text">Recebíveis</p>
          <Tabs
            tabs={[
              { key: 'TODOS', label: 'Todos' },
              { key: 'PENDENTE', label: 'Pendentes' },
              { key: 'VENCIDA', label: 'Vencidos' },
            ]}
            active={filtro}
            onChange={(k) => setFiltro(k as FiltroReceb)}
          />
        </div>
        {loadingReceb ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (recebiveis?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<CheckCircle size={32} />}
            title="Nada em aberto"
            description={filtro === 'VENCIDA' ? 'Nenhuma cobrança vencida.' : 'Nenhuma cobrança pendente na carteira.'}
          />
        ) : (
          <div className="divide-y divide-border">
            {recebiveis!.map((c) => (
              <RecebivelRow key={c.cobranca_id} c={c} onPagar={() => setPagando(c)} />
            ))}
          </div>
        )}
      </Card>

      {/* ── Pagamentos recentes ── */}
      <Card variant="elevated" className="space-y-3">
        <p className="text-sm font-semibold text-text">Pagamentos recentes</p>
        {loadingPag ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (pagamentos?.length ?? 0) === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">Nenhum pagamento registrado ainda.</p>
        ) : (
          <div className="divide-y divide-border">
            {pagamentos!.map((c) => (
              <div key={c.cobranca_id} className="flex items-center gap-3 py-2.5">
                <div className="p-1.5 rounded-lg bg-success/15 text-success shrink-0">
                  <CheckCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/alunos/${c.aluno_id}`} className="text-sm font-medium truncate hover:underline hover:text-accent block">
                    {c.aluno_nome}
                  </Link>
                  <p className="text-xs text-text-muted">
                    {fmtData(c.data_pagamento)} · {c.forma_pagamento === 'PIX_MP' ? 'Pix' : 'Manual'}
                  </p>
                </div>
                <span className="text-sm font-semibold text-text shrink-0">{formatBRL(c.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {pagando && (
        <RegistrarPagamentoModal
          cobranca={pagando as Cobranca}
          onConfirm={async (body) => { await registrarPagamento(pagando, body) }}
          onClose={() => setPagando(null)}
        />
      )}
    </div>
  )
}

function RecebivelRow({ c, onPagar }: { c: CobrancaComAluno; onPagar: () => void }) {
  const atraso = diasAtraso(c.vencimento)
  const vencida = c.status === 'VENCIDA'
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`p-1.5 rounded-lg shrink-0 ${vencida ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}`}>
        {vencida ? <AlertTriangle size={16} /> : <Clock size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/alunos/${c.aluno_id}`} className="text-sm font-medium truncate hover:underline hover:text-accent">
            {c.aluno_nome}
          </Link>
          <Badge tone={vencida ? 'danger' : 'warning'}>{vencida ? 'Vencida' : 'Pendente'}</Badge>
        </div>
        <p className="text-xs text-text-muted">
          Vence {fmtData(c.vencimento)}
          {atraso != null && <span className="text-danger"> · {atraso} dia{atraso === 1 ? '' : 's'} de atraso</span>}
        </p>
      </div>
      <span className="text-sm font-semibold text-text shrink-0">{formatBRL(c.valor)}</span>
      <Button size="sm" variant="primary" className="gap-1 text-xs shrink-0" onClick={onPagar}>
        <DollarSign size={13} /> Pagar
      </Button>
    </div>
  )
}
