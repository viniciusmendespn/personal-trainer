import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Play, Pause, RotateCcw } from 'lucide-react'
import { playAlarm, unlockAudio } from '../../utils/beep'

type Modo = 'regressivo' | 'progressivo'

const DEFAULT_SECONDS = 60
const MAX_SECONDS = 99 * 60 + 59

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Cronômetro em tela cheia para o app do aluno. Dois modos: regressivo (intervalo
 * de descanso, padrão) e progressivo (conta pra cima). Ao abrir vem carregado com
 * `initialSeconds` mas aguarda o aluno tocar em Iniciar. Ao zerar o regressivo,
 * dispara alerta visual + sonoro (Web Audio) + vibração.
 */
export function CronometroOverlay({
  open,
  onClose,
  initialSeconds,
  label,
}: {
  open: boolean
  onClose: () => void
  initialSeconds?: number
  label?: string
}) {
  const baseSeconds = initialSeconds && initialSeconds > 0 ? initialSeconds : DEFAULT_SECONDS
  const [modo, setModo] = useState<Modo>('regressivo')
  const [running, setRunning] = useState(false)
  const [displayMs, setDisplayMs] = useState(baseSeconds * 1000)
  const [done, setDone] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')

  // regressivo: instante-alvo do fim; progressivo: instante de início (ambos em epoch ms)
  const anchorRef = useRef(0)
  const wakeRef = useRef<WakeLockSentinel | null>(null)

  function releaseWakeLock() {
    try {
      void wakeRef.current?.release()
    } catch {
      /* noop */
    }
    wakeRef.current = null
  }

  async function requestWakeLock() {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }).wakeLock
      if (wl) wakeRef.current = await wl.request('screen')
    } catch {
      /* sem suporte / negado — ignora */
    }
  }

  // (Re)inicializa o estado a cada abertura.
  useEffect(() => {
    if (!open) return
    setModo('regressivo')
    setRunning(false)
    setDone(false)
    setEditing(false)
    setDisplayMs(baseSeconds * 1000)
  }, [open, baseSeconds])

  // Libera o wake lock ao desmontar.
  useEffect(() => () => releaseWakeLock(), [])

  // Tick principal — recalcula a partir de Date.now() para não acumular drift.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const now = Date.now()
      if (modo === 'regressivo') {
        const rem = anchorRef.current - now
        if (rem <= 0) {
          setDisplayMs(0)
          setRunning(false)
          setDone(true)
          releaseWakeLock()
          playAlarm()
          navigator.vibrate?.([200, 100, 200, 100, 300])
          return
        }
        setDisplayMs(rem)
      } else {
        setDisplayMs(now - anchorRef.current)
      }
    }, 200)
    return () => clearInterval(id)
  }, [running, modo])

  // O flash visual de "concluído" some sozinho após alguns segundos.
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => setDone(false), 6000)
    return () => clearTimeout(id)
  }, [done])

  function start() {
    unlockAudio()
    setDone(false)
    const now = Date.now()
    anchorRef.current = modo === 'regressivo' ? now + displayMs : now - displayMs
    setRunning(true)
    void requestWakeLock()
  }

  function pause() {
    setRunning(false)
    releaseWakeLock()
  }

  function reset() {
    setRunning(false)
    setDone(false)
    releaseWakeLock()
    setDisplayMs(modo === 'regressivo' ? baseSeconds * 1000 : 0)
  }

  function addSeconds(sec: number) {
    setDone(false)
    if (running) anchorRef.current += sec * 1000
    setDisplayMs((d) => Math.min(MAX_SECONDS * 1000, Math.max(0, d + sec * 1000)))
  }

  function trocarModo(m: Modo) {
    if (m === modo) return
    setRunning(false)
    setDone(false)
    releaseWakeLock()
    setModo(m)
    setDisplayMs(m === 'regressivo' ? baseSeconds * 1000 : 0)
  }

  function startEdit() {
    if (running) return
    setEditText(fmt(displayMs))
    setEditing(true)
  }

  function commitEdit() {
    const parts = editText.split(':')
    let secs: number
    if (parts.length === 2) secs = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0)
    else secs = parseInt(editText, 10) || 0
    secs = Math.max(0, Math.min(secs, MAX_SECONDS))
    setDisplayMs(secs * 1000)
    setDone(false)
    setEditing(false)
  }

  function fechar() {
    pause()
    onClose()
  }

  if (!open) return null

  const tabCls = (m: Modo) =>
    `px-4 py-1.5 text-sm transition-colors ${
      modo === m ? 'bg-accent/15 text-accent-hover font-medium' : 'text-text-muted hover:text-text'
    }`

  const alerta = displayMs <= 5000 && modo === 'regressivo' && running
  const numCor = done ? 'text-energy' : alerta ? 'text-warning' : 'text-text'

  return createPortal(
    <div className={`fixed inset-0 z-[60] flex flex-col bg-bg ${done ? 'animate-pulse' : ''}`}>
      <div className="flex items-center justify-between p-4">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          <button type="button" onClick={() => trocarModo('regressivo')} className={tabCls('regressivo')}>
            Intervalo
          </button>
          <button type="button" onClick={() => trocarModo('progressivo')} className={tabCls('progressivo')}>
            Cronômetro
          </button>
        </div>
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar cronômetro"
          className="p-2 rounded-lg text-text-secondary hover:bg-white/5 hover:text-text"
        >
          <X size={26} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
        {label && (
          <p className="text-text-secondary text-lg sm:text-2xl mb-2 text-center max-w-full truncate">{label}</p>
        )}
        {editing ? (
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value.replace(/[^\d:]/g, ''))}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
            }}
            inputMode="numeric"
            placeholder="MM:SS"
            className="w-full max-w-[7ch] bg-transparent text-center font-display tabular-nums leading-none text-[22vw] sm:text-[12rem] text-text border-b-2 border-accent focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            disabled={running}
            className={`font-display tabular-nums leading-none text-[26vw] sm:text-[16rem] transition-colors disabled:cursor-default ${numCor}`}
          >
            {fmt(displayMs)}
          </button>
        )}
        {done && (
          <p className="mt-4 text-energy font-display text-2xl sm:text-4xl font-semibold">Intervalo concluído!</p>
        )}
        {!running && !done && !editing && (
          <p className="mt-3 text-text-muted text-sm">Toque no tempo para ajustar</p>
        )}
      </div>

      {modo === 'regressivo' && (
        <div className="flex items-center justify-center gap-2 px-4 pb-2">
          {[10, 30, 60].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addSeconds(s)}
              className="px-4 py-2 rounded-full border border-border text-text-secondary hover:border-accent hover:text-text text-sm"
            >
              +{s < 60 ? `${s}s` : '1min'}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 p-6 pb-10">
        <button
          type="button"
          onClick={reset}
          aria-label="Resetar"
          className="p-4 rounded-full bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text"
        >
          <RotateCcw size={28} />
        </button>
        <button
          type="button"
          onClick={running ? pause : start}
          aria-label={running ? 'Pausar' : 'Iniciar'}
          className="p-6 rounded-full bg-energy text-[#0c1404] shadow-[var(--shadow-glow-energy)] hover:bg-energy-hover transition-colors"
        >
          {running ? <Pause size={40} /> : <Play size={40} className="translate-x-0.5" />}
        </button>
        {/* espaçador para manter o botão de play centralizado */}
        <div className="w-[60px]" aria-hidden="true" />
      </div>
    </div>,
    document.body
  )
}
