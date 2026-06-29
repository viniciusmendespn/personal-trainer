import type { HistoricoMes } from '../../api/alunoApp'

// Paleta fixa (espelha src/index.css tema escuro) — inline pra captura confiável no html2canvas,
// que nem sempre resolve classes Tailwind / CSS custom properties no nó clonado.
const C = {
  bg: '#08070d',
  surface: '#13121c',
  border: '#2a2838',
  text: '#f1f0f7',
  muted: '#8b8a99',
  energy: '#a3e635',
  accent: '#6366f1',
  warning: '#fbbf24',
}

function formatVolume(v?: number): string {
  if (!v || v <= 0) return '—'
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')} t`
  return `${Math.round(v)} kg`
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** Card 1080×1920 (story do Instagram) com o resumo do mês de treinos do aluno. */
export function StoryShareCard({ data, nome }: { data: HistoricoMes; nome?: string }) {
  const { ano, mes, dias } = data
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay()

  const treinados = new Set<number>()
  const checkinPorDia: Record<number, string> = {}
  const collage: string[] = []
  for (const [diaIso, sessoes] of Object.entries(dias)) {
    const n = parseInt(diaIso.slice(8, 10), 10)
    treinados.add(n)
    for (const s of sessoes) {
      if (s.checkin_url) {
        if (!checkinPorDia[n]) checkinPorDia[n] = s.checkin_url
        collage.push(s.checkin_url)
      }
    }
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) cells.push(null)
  for (let d = 1; d <= diasNoMes; d++) cells.push(d)

  const collageTop = collage.slice(-3)

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        background: `linear-gradient(160deg, ${C.bg} 0%, #0d0b16 55%, ${C.bg} 100%)`,
        color: C.text,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '90px 72px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 1, color: C.energy }}>COACHPILOT</div>
        <div style={{ fontSize: 30, color: C.muted }}>{nome || 'Meu treino'}</div>
      </div>

      {/* Título do mês */}
      <div style={{ marginTop: 80 }}>
        <div style={{ fontSize: 44, color: C.muted, fontWeight: 500 }}>{MESES[mes - 1]} {ano}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 8 }}>
          <span style={{ fontSize: 220, fontWeight: 800, lineHeight: 0.95, color: C.energy }}>{data.dias_treinados}</span>
          <span style={{ fontSize: 56, fontWeight: 700 }}>dias treinados</span>
        </div>
      </div>

      {/* Calendário heatmap */}
      <div style={{ marginTop: 70 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 121px)', gap: 14, marginBottom: 14 }}>
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 28, color: C.muted }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 121px)', gap: 14 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={i} style={{ width: 121, height: 121 }} />
            const foi = treinados.has(d)
            const foto = checkinPorDia[d]
            return (
              <div
                key={i}
                style={{
                  width: 121,
                  height: 121,
                  borderRadius: 16,
                  background: foto ? undefined : foi ? C.energy : C.surface,
                  border: `2px solid ${foi ? C.energy : C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {foto && (
                  <img
                    src={foto}
                    crossOrigin="anonymous"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                <span
                  style={{
                    position: 'relative',
                    fontSize: 26,
                    fontWeight: foi ? 700 : 400,
                    color: foto ? '#fff' : foi ? '#0c1404' : C.muted,
                    textShadow: foto ? '0 1px 4px rgba(0,0,0,0.8)' : undefined,
                  }}
                >
                  {d}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Colagem de fotos de check-in (se houver) */}
      {collageTop.length > 0 && (
        <div style={{ display: 'flex', gap: 18, marginTop: 56, justifyContent: 'center' }}>
          {collageTop.map((url, i) => (
            <div key={i} style={{ width: 288, height: 288, borderRadius: 24, overflow: 'hidden', border: `2px solid ${C.border}` }}>
              <img src={url} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 24, justifyContent: 'space-between' }}>
        <Stat label="Volume" value={formatVolume(data.volume_total)} color={C.accent} />
        <Stat label="Recordes" value={String(data.prs_total)} color={C.warning} />
        <Stat label="Sequência" value={`${data.streak_atual} sem`} color={C.energy} />
      </div>

      <div style={{ textAlign: 'center', marginTop: 64, fontSize: 30, color: C.muted }}>
        Treine com seu personal no CoachPilot
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        width: 296,
        boxSizing: 'border-box',
        background: C.surface,
        border: `2px solid ${C.border}`,
        borderRadius: 28,
        padding: '36px 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 30, color: C.muted, marginTop: 6 }}>{label}</div>
    </div>
  )
}
