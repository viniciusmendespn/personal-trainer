import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: 'var(--color-text)',
  fontSize: 12,
}
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 12 }
/** Eixo de volume em toneladas a partir de 1000 kg: com um exercício somando em vários grupos,
 *  o total da semana passa de 5 dígitos e "10500" era cortado pela margem do eixo. */
const fmtVolumeEixo = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}t` : String(v))
// 12 matizes, ordem fixa, com passos próprios por tema (ver `--color-chart-*` em index.css).
export const PALETA_GRUPOS = Array.from({ length: 12 }, (_, i) => `var(--color-chart-${i + 1})`)

export interface ItemLegenda {
  nome: string
  cor: string
  /** Traço tracejado em vez de bolinha — p/ séries de linha (ex.: PSE). */
  tracejado?: boolean
}

/** Legenda em HTML, fora do SVG do Recharts. O `<Legend>` nativo mora dentro da altura fixa do
 *  `ResponsiveContainer`: com muitas séries ele quebra em várias linhas e engole a área de plot
 *  até o gráfico sumir. Aqui ela cresce para baixo sem tirar um pixel do gráfico.
 *  O rótulo usa tinta de texto; a marca ao lado é quem carrega a identidade. */
export function LegendaGrafico({ itens, className = '' }: { itens: ItemLegenda[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-secondary ${className}`}>
      {itens.map((it) => (
        <li key={it.nome} className="flex items-center gap-1.5">
          {it.tracejado ? (
            <span aria-hidden className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: it.cor }} />
          ) : (
            <span aria-hidden className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: it.cor }} />
          )}
          {it.nome}
        </li>
      ))}
    </ul>
  )
}

interface TooltipGruposProps {
  active?: boolean
  label?: string | number
  payload?: { name?: string; value?: number | string; color?: string }[]
}

function TooltipGrupos({ active, label, payload }: TooltipGruposProps) {
  if (!active || !payload?.length) return null
  const itens = payload
    .map((p) => ({ nome: String(p.name ?? ''), valor: Number(p.value) || 0, cor: p.color }))
    .filter((p) => p.valor > 0)
    .sort((a, b) => b.valor - a.valor)
  if (!itens.length) return null
  return (
    <div style={{ ...chartTip, padding: '8px 10px' }}>
      <p className="mb-1 font-medium">{label}</p>
      {itens.map((it) => (
        <p key={it.nome} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ background: it.cor }} />
          {it.nome}: {it.valor.toLocaleString('pt-BR')} kg
        </p>
      ))}
    </div>
  )
}

/** Volume semanal empilhado por grupo muscular — compartilhado entre portal e app do aluno. */
export function VolumeGruposChart({ data, grupos }: {
  data: Record<string, string | number>[]
  grupos: string[]
}) {
  const cor = (i: number) => PALETA_GRUPOS[i % PALETA_GRUPOS.length]
  return (
    <>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="semana" tick={axisTick} stroke="var(--color-border-strong)" />
          <YAxis tick={axisTick} stroke="var(--color-border-strong)" width={44} tickFormatter={fmtVolumeEixo} />
          {/* Com 10+ grupos o tooltip listava todos, inclusive os zerados da semana:
              mostra só quem treinou, do maior para o menor. */}
          <Tooltip content={<TooltipGrupos />} />
          {grupos.map((g, i) => (
            <Bar
              key={g}
              dataKey={g}
              stackId="grupo"
              fill={cor(i)}
              name={g}
              // Fresta de 2px na cor da superfície: separa os segmentos empilhados
              // mesmo quando duas cores vizinhas se parecem.
              stroke="var(--color-surface)"
              strokeWidth={2}
              radius={i === grupos.length - 1 ? [6, 6, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {/* A legenda é o que dá identidade sem depender só da cor — com 12 séries
          possíveis, alguns pares vizinhos ficam próximos para daltonismo. */}
      <LegendaGrafico className="mt-2" itens={grupos.map((g, i) => ({ nome: g, cor: cor(i) }))} />
    </>
  )
}
