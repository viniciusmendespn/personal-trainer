// Render compartilhado do histórico de comissões — usado pelo painel do divulgador
// (PainelPage) e pelo drill-down do admin (AdminDivulgadorDetail).
import { Check } from 'lucide-react'
import type React from 'react'
import type { MesComissao } from '../api/divulgador'
import { Card } from '../components/ui'

export function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

export function mesLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[parseInt(m, 10) - 1]}/${y.slice(2)}`
}

export function DivStatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
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

// Altura útil da barra, em px. NÃO usar % aqui: o `items-end` do container impede que as
// colunas estiquem, elas ficam com altura automática, e uma % dentro de pai sem altura
// definida vira `auto` — a div da barra (vazia) colapsa para 0 e só sobram as legendas.
const BARRA_AREA_PX = 104

export function BarrasMeses({ meses }: { meses: MesComissao[] }) {
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
            style={{
              height: m.comissao_valor > 0
                ? `${Math.max(Math.round((m.comissao_valor / max) * BARRA_AREA_PX), 6)}px`
                : '2px',
              opacity: m.comissao_valor > 0 ? 1 : 0.15,
            }}
            title={`${mesLabel(m.mes)}: ${brl(m.comissao_valor)}`}
          />
          <span className="text-[10px] text-text-muted">{mesLabel(m.mes)}</span>
        </div>
      ))}
    </div>
  )
}

export function TabelaMeses({ meses, mesAtualMes }: { meses: MesComissao[]; mesAtualMes: string }) {
  return (
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
            {[...meses].reverse().map(m => (
              <tr key={m.mes} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 font-medium">{mesLabel(m.mes)}{m.mes === mesAtualMes && <span className="ml-1.5 text-[10px] text-accent">(em curso)</span>}</td>
                <td className="px-4 py-3 text-right">{brl(m.base_valor)}</td>
                <td className="px-4 py-3 text-center">{m.vendas_novas}</td>
                <td className="px-4 py-3 text-center">{pct(m.pct)}{m.bonus > 0 && <span className="text-[10px] text-accent"> +{brl(m.bonus)}</span>}</td>
                <td className="px-4 py-3 text-right font-semibold">{brl(m.comissao_valor)}</td>
                <td className="px-4 py-3 text-center">
                  {m.comissao_valor <= 0 ? (
                    <span className="text-text-muted text-xs">—</span>
                  ) : m.mes === mesAtualMes ? (
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
  )
}
