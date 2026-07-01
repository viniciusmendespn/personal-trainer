import type { ReactElement } from 'react'
import type { HistoricoMes } from '../../api/alunoApp'

// Paleta fixa (espelha src/index.css tema escuro).
const C = {
  bg: '#08070d',
  bg2: '#0d0b16',
  surface: '#16141f',
  border: '#2a2838',
  text: '#f1f0f7',
  muted: '#8b8a99',
  energy: '#a3e635',
  accent: '#6366f1',
  warning: '#fbbf24',
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const CELL = 110
const GAP = 12

function formatVolume(v?: number): string {
  if (!v || v <= 0) return '0'
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')}t`
  return `${Math.round(v)}kg`
}

export interface StoryAssets {
  nome?: string
  /** mapa checkin_url → dataURL (já pré-baixado p/ o Satori embutir) */
  photoMap: Record<string, string>
  /** dataURL da foto escolhida manualmente (null = forçar gradiente; undefined = auto) */
  heroOverride?: string | null
  /** CSS objectPosition para o hero, ex: "center 30%" */
  heroPosition?: string
}

/**
 * Constrói a árvore (apenas elementos host: div/img/span) que o Satori rasteriza.
 * Regras do Satori: todo container com mais de um filho precisa de `display:flex`; sem grid.
 */
export function buildStoryTree(data: HistoricoMes, assets: StoryAssets): ReactElement {
  const { ano, mes, dias } = data
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay()
  const { photoMap, nome } = assets

  const treinados = new Set<number>()
  const fotoPorDia: Record<number, string> = {}
  for (const [diaIso, sessoes] of Object.entries(dias)) {
    const n = parseInt(diaIso.slice(8, 10), 10)
    treinados.add(n)
    for (const s of sessoes) {
      const d = s.checkin_url ? photoMap[s.checkin_url] : undefined
      if (d && !fotoPorDia[n]) fotoPorDia[n] = d
    }
  }
  const diasComFoto = Object.keys(fotoPorDia).map(Number).sort((a, b) => b - a)
  const heroFotoAuto = diasComFoto.length ? fotoPorDia[diasComFoto[0]] : null
  const heroFoto = assets.heroOverride !== undefined ? assets.heroOverride : heroFotoAuto

  // Células do calendário em semanas (linhas de 7).
  const cells: (number | null)[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) cells.push(null)
  for (let d = 1; d <= diasNoMes; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const semanas: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) semanas.push(cells.slice(i, i + 7))

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: C.bg,
        backgroundImage: `linear-gradient(170deg, ${C.bg2} 0%, ${C.bg} 62%, #050409 100%)`,
        color: C.text,
        fontFamily: 'Inter',
      }}
    >
      {/* ── HERO ── */}
      <div style={{ display: 'flex', width: 1080, height: 600, position: 'relative' }}>
        {heroFoto ? (
          <img src={heroFoto} width={1080} height={600} style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 600, objectFit: 'cover', objectPosition: assets.heroPosition ?? 'center top' }} />
        ) : (
          <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: 1080, height: 600, backgroundImage: `linear-gradient(135deg, ${C.energy} 0%, #4f46e5 55%, ${C.accent} 100%)` }} />
        )}
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: 1080, height: 600, backgroundImage: 'linear-gradient(180deg, rgba(8,7,13,0.55) 0%, rgba(8,7,13,0) 30%, rgba(8,7,13,0) 52%, rgba(8,7,13,0.96) 100%)' }} />

        <div style={{ display: 'flex', alignItems: 'center', position: 'absolute', top: 60, left: 72 }}>
          <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, backgroundColor: C.energy, marginRight: 14 }} />
          <span style={{ fontFamily: 'Sora', fontSize: 42, fontWeight: 700, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>CoachPilot</span>
        </div>
        {nome && (
          <div style={{ position: 'absolute', top: 68, right: 72, maxWidth: 420, fontSize: 30, fontWeight: 500, color: 'rgba(255,255,255,0.92)', textAlign: 'right', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            {nome}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: 72, bottom: 44 }}>
          <div style={{ display: 'flex', width: 84, height: 6, backgroundColor: C.energy, borderRadius: 3, marginBottom: 18 }} />
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'Sora', fontSize: 66, fontWeight: 800, color: '#fff' }}>{MESES[mes - 1]}</span>
            <span style={{ fontFamily: 'Sora', fontSize: 66, fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginLeft: 16 }}>{ano}</span>
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '48px 72px 46px' }}>
        {/* Número de dias */}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontFamily: 'Sora', fontSize: 220, fontWeight: 800, lineHeight: 0.85, color: C.energy }}>{data.dias_treinados}</span>
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 28, paddingBottom: 32 }}>
            <span style={{ fontFamily: 'Sora', fontSize: 58, fontWeight: 700, lineHeight: 1.04, color: C.text }}>dias</span>
            <span style={{ fontFamily: 'Sora', fontSize: 58, fontWeight: 700, lineHeight: 1.04, color: C.text }}>treinados</span>
          </div>
        </div>

        {/* Calendário */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 38 }}>
          <div style={{ display: 'flex', gap: GAP, marginBottom: GAP }}>
            {DIAS_SEMANA.map((d, i) => (
              <div key={i} style={{ display: 'flex', width: CELL, justifyContent: 'center', fontSize: 28, fontWeight: 500, color: C.muted }}>{d}</div>
            ))}
          </div>
          {semanas.map((semana, wi) => (
            <div key={wi} style={{ display: 'flex', gap: GAP, marginBottom: wi < semanas.length - 1 ? GAP : 0 }}>
              {semana.map((d, di) => {
                if (d === null) return <div key={di} style={{ display: 'flex', width: CELL, height: CELL }} />
                const foi = treinados.has(d)
                const foto = fotoPorDia[d]
                return (
                  <div
                    key={di}
                    style={{
                      display: 'flex',
                      width: CELL,
                      height: CELL,
                      borderRadius: 22,
                      position: 'relative',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: foto ? C.surface : foi ? C.energy : C.surface,
                      border: foi ? `2px solid ${C.energy}` : `2px solid ${C.border}`,
                    }}
                  >
                    {foto && <img src={foto} width={CELL} height={CELL} style={{ position: 'absolute', top: 0, left: 0, width: CELL, height: CELL, borderRadius: 20, objectFit: 'cover' }} />}
                    {foto && <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: CELL, height: CELL, borderRadius: 20, backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)' }} />}
                    <span
                      style={{
                        fontSize: 30,
                        fontWeight: foi ? 700 : 500,
                        color: foto ? '#fff' : foi ? '#0c1404' : C.muted,
                        ...(foto ? { textShadow: '0 1px 5px rgba(0,0,0,0.95)' } : {}),
                      }}
                    >
                      {d}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexGrow: 1 }} />

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {statCard('Volume', formatVolume(data.volume_total), C.accent)}
          {statCard('Recordes', String(data.prs_total), C.warning)}
          {statCard('Sequência', `${data.streak_atual} sem`, C.energy)}
        </div>

        {/* Rodapé */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 34 }}>
          <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 6, backgroundColor: C.energy, marginRight: 14 }} />
          <span style={{ fontFamily: 'Sora', fontSize: 32, fontWeight: 700, color: C.text }}>CoachPilot</span>
          <span style={{ fontSize: 30, color: C.muted, marginLeft: 14 }}>· seu treino, todo dia</span>
        </div>
      </div>
    </div>
  )
}

function statCard(label: string, value: string, color: string): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 296,
        height: 196,
        borderRadius: 30,
        backgroundColor: C.surface,
        border: `2px solid ${C.border}`,
        position: 'relative',
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: 296, height: 6, backgroundColor: color, borderRadius: 3 }} />
      <span style={{ fontFamily: 'Sora', fontSize: 62, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 26, color: C.muted, marginTop: 14, textTransform: 'uppercase', letterSpacing: 2 }}>{label}</span>
    </div>
  )
}
