import { useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Share2, Flame, Trophy, Dumbbell, CalendarDays, Loader2, Download, MoveVertical, ImageOff } from 'lucide-react'
import { alunoApi, type HistoricoMes } from '../../api/alunoApp'
import { Card, Spinner, Modal, Button, EmptyState, useToast } from '../ui'
import { AlunoSessaoDetalheCard } from './SessaoDetalheCard'
import { shareBlob, downloadBlob } from '../../utils/shareStory'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function formatVolume(v?: number): string {
  if (!v || v <= 0) return '0'
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')}t`
  return `${Math.round(v)}kg`
}

function StatChip({ icon, value, label, tone }: { icon: React.ReactNode; value: React.ReactNode; label: string; tone: string }) {
  return (
    <div className="flex-1 rounded-xl bg-surface-elevated border border-border px-2 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1" style={{ color: tone }}>
        {icon}
        <span className="text-base font-bold text-text">{value}</span>
      </div>
      <div className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wide">{label}</div>
    </div>
  )
}

function extrairFotos(dias: HistoricoMes['dias']): { url: string; dia: number }[] {
  const fotos: { url: string; dia: number }[] = []
  for (const [diaIso, sessoes] of Object.entries(dias)) {
    const dia = parseInt(diaIso.slice(8, 10), 10)
    for (const s of sessoes) {
      if (s.checkin_url) {
        fotos.push({ url: s.checkin_url, dia })
        break
      }
    }
  }
  return fotos.sort((a, b) => b.dia - a.dia)
}

interface CalendarioMesProps {
  /** Busca o resumo do mês. Default: app do aluno (`alunoApi.historicoMes`). */
  fetcher?: (ano: number, mes: number) => Promise<HistoricoMes>
  /** Prefixo da queryKey (diferencie por aluno no portal). */
  queryKeyPrefix?: string
  /** Mostra as fotos de check-in nas células. Portal passa `false`. */
  mostrarFotos?: boolean
  /** Exibe o botão de gerar/compartilhar story. Portal passa `false`. */
  permitirCompartilhar?: boolean
  /** Renderiza o detalhe de uma sessão no modal do dia. Default: card do app do aluno. */
  renderDetalhe?: (sessaoId: string) => ReactNode
}

export function CalendarioMes({
  fetcher = (ano, mes) => alunoApi.historicoMes(ano, mes),
  queryKeyPrefix = 'aluno-historico-mes',
  mostrarFotos = true,
  permitirCompartilhar = true,
  renderDetalhe = (sessaoId) => <AlunoSessaoDetalheCard sessaoId={sessaoId} />,
}: CalendarioMesProps = {}) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1) // 1-12
  const [diaSel, setDiaSel] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [heroUrlSel, setHeroUrlSel] = useState<string | null | undefined>(undefined)
  const [heroPosSel, setHeroPosSel] = useState(0)
  const [arrastou, setArrastou] = useState(false)
  const previewBoxRef = useRef<HTMLDivElement>(null)
  const imgRatioRef = useRef(1) // naturalHeight / naturalWidth da foto carregada
  const dragRef = useRef<{ startY: number; startPos: number; rangePx: number } | null>(null)
  const toast = useToast()
  const fileName = `coachpilot-${ano}-${String(mes).padStart(2, '0')}.png`

  const { data, isLoading } = useQuery({
    queryKey: [queryKeyPrefix, ano, mes],
    queryFn: () => fetcher(ano, mes),
    staleTime: 60_000,
  })
  const me = useQuery({ queryKey: ['aluno-me'], queryFn: alunoApi.me, staleTime: 5 * 60_000, enabled: permitirCompartilhar })

  const noFuturo = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes >= hoje.getMonth() + 1)

  function navegar(delta: number) {
    let m = mes + delta
    let a = ano
    if (m < 1) { m = 12; a -= 1 }
    if (m > 12) { m = 1; a += 1 }
    setAno(a)
    setMes(m)
  }

  async function gerarPreview(heroUrl?: string | null, heroPos = 0) {
    if (!data) return
    setSharing(true)
    try {
      const { buildStoryPng } = await import('../../utils/storyImage')
      const blob = await buildStoryPng(data, me.data?.nome, {
        heroUrl,
        heroPosition: heroUrl !== undefined && heroUrl !== null ? `center ${heroPos}%` : undefined,
      })
      setPreview({ url: URL.createObjectURL(blob), blob })
    } catch (e) {
      console.warn('[story] falhou', e)
      toast.show('Não consegui gerar a imagem. Tenta de novo.', 'error')
    } finally {
      setSharing(false)
    }
  }

  function abrirCompartilhar() {
    if (!data) return
    const fotos = extrairFotos(data.dias)
    if (fotos.length > 0) {
      selecionarFoto(fotos[0].url)
      setPickerOpen(true)
    } else {
      gerarPreview(undefined, 0)
    }
  }

  function selecionarFoto(url: string | null) {
    setHeroUrlSel(url)
    setHeroPosSel(0)
    setArrastou(false)
    imgRatioRef.current = 1
  }

  // ── Arraste vertical do preview (mouse + toque via pointer events) ───────────
  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    imgRatioRef.current = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1
  }
  function onDragStart(e: React.PointerEvent<HTMLDivElement>) {
    const box = previewBoxRef.current
    if (!box) return
    const w = box.getBoundingClientRect().width
    const boxH = w / (1080 / 600) // altura do box no aspecto do banner
    const scaledH = w * imgRatioRef.current // altura da img escalada p/ cobrir a largura
    const rangePx = Math.max(1, scaledH - boxH) // curso vertical disponível
    dragRef.current = { startY: e.clientY, startPos: heroPosSel, rangePx }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onDragMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d) return
    if (!arrastou) setArrastou(true)
    const dy = e.clientY - d.startY
    // arrastar p/ baixo (dy>0) revela o topo → diminui o %
    const next = Math.min(100, Math.max(0, d.startPos - (dy / d.rangePx) * 100))
    setHeroPosSel(next)
  }
  function onDragEnd() {
    dragRef.current = null
  }

  function fecharPreview() {
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p.url)
      return null
    })
  }

  async function compartilharImagem() {
    if (!preview) return
    const res = await shareBlob(preview.blob, fileName)
    if (res === 'unsupported') {
      downloadBlob(preview.blob, fileName)
      toast.show('Imagem salva! Poste nos seus stories 🎉', 'success')
    }
  }

  const fotos = data ? extrairFotos(data.dias) : []
  const dias = data?.dias ?? {}
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay()
  const cells: (number | null)[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) cells.push(null)
  for (let d = 1; d <= diasNoMes; d++) cells.push(d)

  const keyDia = (d: number) => `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  return (
    <div className="space-y-4 pb-4">
      {/* Navegação de mês */}
      <div className="flex items-center justify-between">
        <button onClick={() => navegar(-1)} className="p-2 -ml-2 text-text-muted hover:text-text transition-colors" aria-label="Mês anterior">
          <ChevronLeft size={20} />
        </button>
        <p className="font-display font-semibold">{MESES[mes - 1]} {ano}</p>
        <button
          onClick={() => navegar(1)}
          disabled={noFuturo}
          className="p-2 -mr-2 text-text-muted hover:text-text transition-colors disabled:opacity-30"
          aria-label="Próximo mês"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <>
          {/* Destaques do mês */}
          <div className="flex gap-2">
            <StatChip icon={<CalendarDays size={14} />} value={data?.dias_treinados ?? 0} label="dias" tone="var(--color-energy)" />
            <StatChip icon={<Dumbbell size={14} />} value={formatVolume(data?.volume_total)} label="volume" tone="var(--color-accent)" />
            <StatChip icon={<Trophy size={14} />} value={data?.prs_total ?? 0} label="recordes" tone="var(--color-warning)" />
            <StatChip icon={<Flame size={14} />} value={data?.streak_atual ?? 0} label="sequência" tone="var(--color-energy)" />
          </div>

          {/* Calendário */}
          <Card variant="elevated" className="space-y-2">
            <div className="grid grid-cols-7 gap-1.5">
              {DIAS_SEMANA.map((d, i) => (
                <div key={i} className="text-center text-[11px] text-text-muted font-medium">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((d, i) => {
                if (d === null) return <div key={i} className="aspect-square" />
                const sessoes = dias[keyDia(d)]
                const foi = !!sessoes?.length
                const foto = mostrarFotos ? sessoes?.find((s) => s.checkin_url)?.checkin_url : undefined
                return (
                  <button
                    key={i}
                    onClick={() => foi && setDiaSel(keyDia(d))}
                    disabled={!foi}
                    className={`relative aspect-square rounded-lg flex items-center justify-center overflow-hidden border transition-colors ${
                      foi ? 'border-energy/60' : 'border-border'
                    } ${foto ? '' : foi ? 'bg-energy/15' : 'bg-surface'}`}
                  >
                    {foto && (
                      <img src={foto} crossOrigin="anonymous" alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <span
                      className={`relative text-xs ${foi ? 'font-bold' : 'text-text-muted'}`}
                      style={foto ? { color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.85)' } : foi ? { color: 'var(--color-energy)' } : undefined}
                    >
                      {d}
                    </span>
                    {foi && !foto && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-energy" />
                    )}
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Compartilhar */}
          {permitirCompartilhar && (
            <button
              onClick={abrirCompartilhar}
              disabled={sharing || !data?.dias_treinados}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-energy hover:bg-energy-hover text-[#0c1404] font-semibold py-3 transition-colors disabled:opacity-40"
            >
              {sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
              {sharing ? 'Gerando imagem…' : 'Compartilhar meu mês'}
            </button>
          )}
          {!data?.dias_treinados && (
            <EmptyState icon={<CalendarDays />} title="Nenhum treino neste mês" description="Treinos finalizados aparecem aqui no calendário." />
          )}
        </>
      )}

      {/* Picker de foto de destaque */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Foto de destaque" size="md">
        <div className="space-y-3">
          {/* Preview do banner — arraste ↕ para posicionar */}
          <div
            ref={previewBoxRef}
            className="relative w-full overflow-hidden rounded-xl border border-border bg-surface select-none"
            style={{ aspectRatio: '1080 / 600' }}
          >
            {heroUrlSel ? (
              <>
                <img
                  src={heroUrlSel}
                  alt="Prévia do banner"
                  crossOrigin="anonymous"
                  draggable={false}
                  onLoad={onImgLoad}
                  className="absolute inset-0 w-full h-full object-cover cursor-grab active:cursor-grabbing"
                  style={{ objectPosition: `center ${heroPosSel}%`, touchAction: 'none' }}
                  onPointerDown={onDragStart}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                  onPointerCancel={onDragEnd}
                />
                {!arrastou && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
                      <MoveVertical size={14} /> Arraste para ajustar
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-text-muted">
                <ImageOff size={22} />
                <span className="text-xs">Banner com fundo colorido</span>
              </div>
            )}
          </div>

          {/* Faixa horizontal de fotos (rola lateralmente; suporta muitas fotos) */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => selecionarFoto(null)}
              className={`shrink-0 w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 bg-surface transition-colors ${heroUrlSel === null ? 'border-energy' : 'border-border'}`}
            >
              <ImageOff size={16} className="text-text-muted" />
              <span className="text-[9px] text-text-muted">Sem foto</span>
            </button>
            {fotos.map(({ url, dia }) => (
              <button
                key={url}
                onClick={() => selecionarFoto(url)}
                className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${heroUrlSel === url ? 'border-energy' : 'border-border'}`}
              >
                <img src={url} alt={`dia ${dia}`} crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover" />
                <span className="absolute bottom-0.5 right-0.5 text-[9px] text-white bg-black/60 px-1 rounded">{dia}</span>
              </button>
            ))}
          </div>

          <Button
            variant="energy"
            className="w-full"
            onClick={() => {
              setPickerOpen(false)
              gerarPreview(heroUrlSel, heroPosSel)
            }}
          >
            <span className="flex items-center justify-center gap-1.5">
              {sharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              Gerar imagem
            </span>
          </Button>
        </div>
      </Modal>

      {/* Detalhe do dia */}
      <Modal open={!!diaSel} onClose={() => setDiaSel(null)} title={diaSel ? new Date(diaSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : ''} size="lg">
        <div className="space-y-3">
          {(diaSel ? dias[diaSel] ?? [] : []).map((s) => (
            <Card key={s.sessao_id} variant="flat">
              <p className="font-medium mb-1">{s.treino_nome}</p>
              {renderDetalhe(s.sessao_id)}
            </Card>
          ))}
        </div>
      </Modal>

      {/* Preview da imagem gerada */}
      <Modal open={!!preview} onClose={fecharPreview} title="Seu mês em imagem" size="md">
        {preview && (
          <div className="space-y-4">
            <img src={preview.url} alt="Prévia do story" className="w-full rounded-xl border border-border" />
            <div className="flex gap-2">
              <Button variant="energy" className="flex-1" onClick={compartilharImagem}>
                <span className="flex items-center justify-center gap-1.5"><Share2 size={16} /> Compartilhar</span>
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => downloadBlob(preview.blob, fileName)}>
                <span className="flex items-center justify-center gap-1.5"><Download size={16} /> Baixar</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
