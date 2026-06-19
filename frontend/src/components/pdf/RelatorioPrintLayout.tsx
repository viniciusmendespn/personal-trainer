type Pr = { exercicio: string; carga: number }
type Semana = { semana: string; volume: number }
type AvaliacaoRow = { data: string; peso?: number; percentual_gordura?: number }
type MetricaSerie = { nome: string; unidade?: string; pontos: { data: string; valor: number }[] }

const MINI_CHART_W = 696
const MINI_CHART_H = 90

/** Mini-gráfico de linha em SVG puro (sem Recharts) — capturado via html2canvas num container
 * off-screen, onde SVG simples é mais confiável que um ResponsiveContainer detached do layout. */
function MiniLineChart({ serie }: { serie: MetricaSerie }) {
  const valores = serie.pontos.map((p) => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const range = max - min || 1
  const padX = 8
  const padY = 10
  const innerW = MINI_CHART_W - padX * 2
  const innerH = MINI_CHART_H - padY * 2
  const coords = serie.pontos.map((p, i) => {
    const x = padX + (serie.pontos.length === 1 ? innerW / 2 : (i / (serie.pontos.length - 1)) * innerW)
    const y = padY + innerH - ((p.valor - min) / range) * innerH
    return { x, y }
  })
  const points = coords.map((c) => `${c.x},${c.y}`).join(' ')

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {serie.nome}{serie.unidade ? ` (${serie.unidade})` : ''}
      </p>
      <svg width={MINI_CHART_W} height={MINI_CHART_H} style={{ display: 'block' }}>
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth={2} />
        {coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={2.5} fill="#6366f1" />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b' }}>
        <span>{new Date(serie.pontos[0].data).toLocaleDateString('pt-BR')} · {min}{serie.unidade ?? ''}</span>
        <span>{new Date(serie.pontos[serie.pontos.length - 1].data).toLocaleDateString('pt-BR')} · {max}{serie.unidade ?? ''}</span>
      </div>
    </div>
  )
}

export function RelatorioPrintLayout({
  alunoNome,
  resumo,
  avaliacoes,
  metricas,
}: {
  alunoNome: string
  resumo?: { total_sessoes: number; total_volume: number; sessoes_semana: number; prs: Pr[]; semanas: Semana[] }
  avaliacoes?: AvaliacaoRow[]
  metricas?: MetricaSerie[]
}) {
  const maxVolume = Math.max(1, ...(resumo?.semanas.map((s) => s.volume) ?? [1]))

  return (
    <div style={{ width: 760, padding: 32, background: '#ffffff', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #6366f1', paddingBottom: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, fontFamily: 'Sora, sans-serif' }}>Relatório de evolução</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '4px 0 0' }}>{alunoNome}</p>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      {resumo && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            {[
              ['Sessões totais', resumo.total_sessoes],
              ['Volume total (kg)', Math.round(resumo.total_volume).toLocaleString('pt-BR')],
              ['Sessões esta semana', resumo.sessoes_semana],
            ].map(([label, value]) => (
              <div key={label as string} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 0' }}>{value}</p>
              </div>
            ))}
          </div>

          {resumo.semanas.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Volume por semana</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, borderBottom: '1px solid #e2e8f0' }}>
                {resumo.semanas.map((s) => (
                  <div key={s.semana} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ height: Math.max(4, (s.volume / maxVolume) * 90), background: '#6366f1', borderRadius: '4px 4px 0 0' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {resumo.semanas.map((s) => (
                  <div key={s.semana} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#64748b' }}>{s.semana}</div>
                ))}
              </div>
            </div>
          )}

          {resumo.prs.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recordes pessoais</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {resumo.prs.map((p) => (
                  <span key={p.exercicio} style={{ fontSize: 11, background: '#f1f5f9', borderRadius: 999, padding: '4px 10px' }}>
                    {p.exercicio}: <b>{p.carga} kg</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {metricas && metricas.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Evolução das métricas</p>
          {metricas.map((m) => <MiniLineChart key={m.nome} serie={m} />)}
        </div>
      )}

      {avaliacoes && avaliacoes.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Avaliações físicas</p>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '6px 8px' }}>Data</th>
                <th style={{ padding: '6px 8px' }}>Peso</th>
                <th style={{ padding: '6px 8px' }}>% Gordura</th>
              </tr>
            </thead>
            <tbody>
              {avaliacoes.map((a, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 8px' }}>{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '6px 8px' }}>{a.peso != null ? `${a.peso} kg` : '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{a.percentual_gordura != null ? `${a.percentual_gordura}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
