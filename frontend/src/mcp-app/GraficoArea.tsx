import { useEffect, useRef, useState } from 'react'

/** Gráfico de área com o mesmo desenho do AreaChart do portal (AlunoEvolucaoPage): gradiente
 *  do accent, grade tracejada, pontos e tooltip. SVG próprio em vez de recharts — a biblioteca
 *  dobrava o HTML do widget (~500 KB) para um único gráfico. */
export function GraficoArea({ pontos, unidade, altura = 220 }: { pontos: { rotulo: string; valor: number }[]; unidade: string; altura?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(600)
  const [ativo, setAtivo] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const m = { top: 10, right: 12, bottom: 24, left: 40 }
  const w = largura - m.left - m.right, h = altura - m.top - m.bottom
  const valores = pontos.map(p => p.valor)
  const [y0, y1, passo] = escala(Math.min(...valores), Math.max(...valores))
  const x = (i: number) => m.left + (pontos.length === 1 ? w / 2 : (i * w) / (pontos.length - 1))
  const y = (v: number) => m.top + h - ((v - y0) / (y1 - y0 || 1)) * h
  const xy = pontos.map((p, i) => [x(i), y(p.valor)] as const)
  const linha = curva(xy)
  const area = `${linha} L${xy[xy.length - 1][0]},${m.top + h} L${xy[0][0]},${m.top + h} Z`
  const ticksY: number[] = []
  for (let v = y0; v <= y1 + passo / 2; v += passo) ticksY.push(+v.toFixed(6))
  const cadaX = Math.max(1, Math.ceil(pontos.length / Math.max(2, Math.floor(w / 64))))
  const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

  return <div ref={ref} className="relative w-full" onMouseLeave={() => setAtivo(null)}>
    <svg width={largura} height={altura} className="block max-w-full" aria-hidden="true"
      onMouseMove={e => {
        const bx = e.currentTarget.getBoundingClientRect().left
        const rel = e.clientX - bx
        let melhor = 0
        xy.forEach(([px], i) => { if (Math.abs(px - rel) < Math.abs(xy[melhor][0] - rel)) melhor = i })
        setAtivo(melhor)
      }}>
      <defs><linearGradient id="cpGradiente" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
      </linearGradient></defs>
      {ticksY.map(v => <g key={v}>
        <line x1={m.left} x2={m.left + w} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray="3 3" />
        <text x={m.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--color-text-secondary)">{fmt(v)}</text>
      </g>)}
      <line x1={m.left} x2={m.left + w} y1={m.top + h} y2={m.top + h} stroke="var(--color-border-strong)" />
      <line x1={m.left} x2={m.left} y1={m.top} y2={m.top + h} stroke="var(--color-border-strong)" />
      {pontos.map((p, i) => i % cadaX === 0 && <text key={i} x={x(i)} y={m.top + h + 16} textAnchor="middle" fontSize={12} fill="var(--color-text-secondary)">{p.rotulo}</text>)}
      <path d={area} fill="url(#cpGradiente)" />
      <path d={linha} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinejoin="round" />
      {ativo != null && <line x1={xy[ativo][0]} x2={xy[ativo][0]} y1={m.top} y2={m.top + h} stroke="var(--color-border-strong)" />}
      {xy.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={ativo === i ? 5 : 3} fill="var(--color-accent)" />)}
    </svg>
    {ativo != null && <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-[10px] border border-border-strong bg-surface-elevated px-2.5 py-1.5 text-xs text-text shadow-[var(--shadow-card)] whitespace-nowrap"
      style={{ left: Math.min(Math.max(xy[ativo][0], 60), largura - 60), top: xy[ativo][1] - 8 }}>
      <span className="text-text-muted">{pontos[ativo].rotulo}</span> · <span className="font-medium">{fmt(pontos[ativo].valor)} {unidade}</span>
    </div>}
  </div>
}

/** Faixa e passo "redondos" (1, 2, 2,5, 5 × 10ⁿ) com 4–5 marcas, como o eixo do recharts. */
function escala(min: number, max: number): [number, number, number] {
  if (min === max) { const d = Math.abs(min) * 0.1 || 1; min -= d; max += d }
  const bruto = (max - min) / 4
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= bruto) ?? 10 * mag
  return [Math.floor(min / passo) * passo, Math.ceil(max / passo) * passo, passo]
}

/** Curva monotônica simples (Catmull-Rom → Bézier), equivalente ao type="monotone" do portal. */
function curva(p: readonly (readonly [number, number])[]) {
  if (p.length < 3) return p.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i], b = p[i], c = p[i + 1], e = p[i + 2] ?? c
    const c1y = Math.min(Math.max(b[1] + (c[1] - a[1]) / 6, Math.min(b[1], c[1])), Math.max(b[1], c[1]))
    const c2y = Math.min(Math.max(c[1] - (e[1] - b[1]) / 6, Math.min(b[1], c[1])), Math.max(b[1], c[1]))
    d += ` C${b[0] + (c[0] - a[0]) / 6},${c1y} ${c[0] - (e[0] - b[0]) / 6},${c2y} ${c[0]},${c[1]}`
  }
  return d
}
