import type { HistoricoMes } from '../../api/alunoApp'

// Paleta fixa (espelha src/index.css tema escuro) — inline pra captura confiável no html2canvas,
// que nem sempre resolve classes Tailwind / CSS custom properties no nó clonado.
const C = {
  bg: '#08070d',
  bg2: '#0d0b16',
  surface: '#13121c',
  surfaceEl: '#1c1a28',
  border: '#2a2838',
  text: '#f1f0f7',
  muted: '#8b8a99',
  energy: '#a3e635',
  accent: '#6366f1',
  warning: '#fbbf24',
}
const FONT_DISPLAY = "'Sora', system-ui, sans-serif"
const FONT_SANS = "'Inter', system-ui, sans-serif"
const LOGO_BRANCA = '/novo-logo-slogan-vertical-brancosemfundo.png'

// Geometria (1080×1920)
const W = 1080
const PAD = 72
const CONTENT_W = W - PAD * 2 // 936
const HERO_H = 660
const CELL = 120
const CAL_GAP = 15 // 7*120 + 6*15 = 930 (centralizado nos 936)

function formatVolume(v?: number): string {
  if (!v || v <= 0) return '0'
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')}t`
  return `${Math.round(v)}kg`
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** Card 1080×1920 (story do Instagram) — resumo "Wrapped" do mês de treinos do aluno. */
export function StoryShareCard({ data, nome }: { data: HistoricoMes; nome?: string }) {
  const { ano, mes, dias } = data
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay()

  const treinados = new Set<number>()
  const checkinPorDia: Record<number, string> = {}
  for (const [diaIso, sessoes] of Object.entries(dias)) {
    const n = parseInt(diaIso.slice(8, 10), 10)
    treinados.add(n)
    for (const s of sessoes) {
      if (s.checkin_url && !checkinPorDia[n]) checkinPorDia[n] = s.checkin_url
    }
  }
  // Foto destaque = check-in do dia treinado mais recente que tem foto.
  const diasComFoto = Object.keys(checkinPorDia).map(Number).sort((a, b) => b - a)
  const heroFoto = diasComFoto.length ? checkinPorDia[diasComFoto[0]] : null

  const cells: (number | null)[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) cells.push(null)
  for (let d = 1; d <= diasNoMes; d++) cells.push(d)

  return (
    <div
      style={{
        width: W,
        height: 1920,
        background: `linear-gradient(170deg, ${C.bg2} 0%, ${C.bg} 60%, #050409 100%)`,
        color: C.text,
        fontFamily: FONT_SANS,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── HERO ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: HERO_H, overflow: 'hidden' }}>
        {heroFoto ? (
          <img src={heroFoto} crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${C.energy} 0%, #4f46e5 55%, ${C.accent} 100%)` }} />
        )}
        {/* Overlay p/ legibilidade (escurece base e topo) */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,7,13,0.55) 0%, rgba(8,7,13,0) 28%, rgba(8,7,13,0) 50%, rgba(8,7,13,0.92) 100%)' }} />

        {/* Logo (canto superior esquerdo) */}
        <img src={LOGO_BRANCA} crossOrigin="anonymous" style={{ position: 'absolute', top: 56, left: PAD, height: 132, width: 'auto' }} />

        {/* Nome do aluno (canto superior direito) */}
        {nome && (
          <div style={{ position: 'absolute', top: 70, right: PAD, fontFamily: FONT_SANS, fontSize: 30, fontWeight: 500, color: 'rgba(255,255,255,0.92)', maxWidth: 440, textAlign: 'right', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
            {nome}
          </div>
        )}

        {/* Mês (base do hero) */}
        <div style={{ position: 'absolute', left: PAD, bottom: 48 }}>
          <div style={{ width: 84, height: 6, borderRadius: 3, background: C.energy, marginBottom: 20 }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 64, fontWeight: 800, letterSpacing: -0.5, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
            {MESES[mes - 1]} <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{ano}</span>
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ─────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: `52px ${PAD}px 64px`, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Glow lime atrás do número */}
        <div style={{ position: 'absolute', top: -40, left: PAD - 30, width: 560, height: 560, background: `radial-gradient(circle, rgba(163,230,53,0.16) 0%, rgba(163,230,53,0) 68%)`, pointerEvents: 'none' }} />

        {/* Número gigante de dias */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 28 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 250, fontWeight: 800, lineHeight: 0.82, color: C.energy, letterSpacing: -6 }}>
            {data.dias_treinados}
          </span>
          <div style={{ paddingBottom: 30 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 58, fontWeight: 700, lineHeight: 1.05 }}>dias</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 58, fontWeight: 700, lineHeight: 1.05 }}>treinados</div>
          </div>
        </div>

        {/* Calendário heatmap (centralizado) */}
        <div style={{ marginTop: 56 }}>
          <div style={{ width: CONTENT_W, display: 'flex', justifyContent: 'center' }}>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CELL}px)`, gap: CAL_GAP, marginBottom: CAL_GAP }}>
                {DIAS_SEMANA.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', fontFamily: FONT_SANS, fontSize: 28, fontWeight: 600, color: C.muted }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CELL}px)`, gap: CAL_GAP }}>
                {cells.map((d, i) => {
                  if (d === null) return <div key={i} style={{ width: CELL, height: CELL }} />
                  const foi = treinados.has(d)
                  const foto = checkinPorDia[d]
                  return (
                    <div
                      key={i}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 22,
                        background: foto ? C.surface : foi ? C.energy : C.surface,
                        border: foi ? 'none' : `2px solid ${C.border}`,
                        boxShadow: foi && !foto ? '0 6px 20px rgba(163,230,53,0.25)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      {foto && (
                        <>
                          <img src={foto} crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)' }} />
                        </>
                      )}
                      <span
                        style={{
                          position: 'relative',
                          fontFamily: FONT_SANS,
                          fontSize: 30,
                          fontWeight: foi ? 700 : 500,
                          color: foto ? '#fff' : foi ? '#0c1404' : C.muted,
                          textShadow: foto ? '0 1px 4px rgba(0,0,0,0.9)' : undefined,
                        }}
                      >
                        {d}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Stats */}
        <div style={{ display: 'flex', gap: 24, justifyContent: 'space-between' }}>
          <Stat label="Volume" value={formatVolume(data.volume_total)} color={C.accent} />
          <Stat label="Recordes" value={String(data.prs_total)} color={C.warning} />
          <Stat label="Sequência" value={`${data.streak_atual} sem`} color={C.energy} />
        </div>

        {/* Rodapé */}
        <div style={{ textAlign: 'center', marginTop: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: C.energy }} />
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, color: C.text }}>CoachPilot</span>
          <span style={{ fontFamily: FONT_SANS, fontSize: 30, color: C.muted }}>· seu treino, todo dia</span>
        </div>
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
        borderRadius: 30,
        padding: '38px 18px 32px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: color }} />
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 62, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 27, color: C.muted, marginTop: 12, textTransform: 'uppercase', letterSpacing: 2 }}>{label}</div>
    </div>
  )
}
