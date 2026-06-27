import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Play, Pause, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react'
import { startAlarm, stopAlarm, tick, unlockAudio } from '../../utils/beep'

type Modo = 'regressivo' | 'progressivo'

const DEFAULT_SECONDS = 60
const MAX_SECONDS = 99 * 60 + 59

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Uma coluna de número ajustável por scroll do mouse, arraste vertical ou setas ▲/▼. */
function WheelNumber({
  value,
  max,
  onChange,
  ariaLabel,
}: {
  value: number
  max: number
  onChange: (v: number) => void
  ariaLabel: string
}) {
  const startY = useRef<number | null>(null)
  const acc = useRef(0)
  const STEP_PX = 28

  const change = (delta: number) => onChange(Math.max(0, Math.min(max, value + delta)))

  return (
    <div
      className="flex flex-col items-center select-none touch-none"
      onWheel={(e) => change(e.deltaY < 0 ? 1 : -1)}
      onTouchStart={(e) => {
        startY.current = e.touches[0].clientY
        acc.current = 0
      }}
      onTouchMove={(e) => {
        if (startY.current == null) return
        acc.current += startY.current - e.touches[0].clientY
        startY.current = e.touches[0].clientY
        while (acc.current >= STEP_PX) {
          change(1)
          acc.current -= STEP_PX
        }
        while (acc.current <= -STEP_PX) {
          change(-1)
          acc.current += STEP_PX
        }
      }}
      onTouchEnd={() => {
        startY.current = null
      }}
    >
      <button
        type="button"
        onClick={() => change(1)}
        aria-label={`Aumentar ${ariaLabel}`}
        className="p-1 text-text-muted hover:text-text"
      >
        <ChevronUp size={32} />
      </button>
      <span className="font-display tabular-nums leading-none text-[16vw] sm:text-[9rem] text-text">
        {String(value).padStart(2, '0')}
      </span>
      <button
        type="button"
        onClick={() => change(-1)}
        aria-label={`Diminuir ${ariaLabel}`}
        className="p-1 text-text-muted hover:text-text"
      >
        <ChevronDown size={32} />
      </button>
    </div>
  )
}

/**
 * Cronômetro em tela cheia para o app do aluno. Dois modos: regressivo (intervalo
 * de descanso, padrão) e progressivo (conta pra cima). Ao abrir vem carregado com
 * `initialSeconds` mas aguarda o aluno tocar em Iniciar. Nos últimos 5 s dá um tique
 * por segundo e, ao zerar o regressivo, dispara alarme contínuo + flash sólido +
 * vibração até o aluno dispensar.
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
  const [flashOn, setFlashOn] = useState(false)

  // regressivo: instante-alvo do fim; progressivo: instante de início (ambos em epoch ms)
  const anchorRef = useRef(0)
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const lastTickSecRef = useRef<number | null>(null)

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
    setDisplayMs(baseSeconds * 1000)
    lastTickSecRef.current = null
  }, [open, baseSeconds])

  // Limpeza ao desmontar: libera wake lock e silencia qualquer alarme.
  useEffect(
    () => () => {
      releaseWakeLock()
      stopAlarm()
    },
    []
  )

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
          startAlarm()
          navigator.vibrate?.([300, 150, 300, 150, 300, 150, 500])
          return
        }
        setDisplayMs(rem)
        const wholeSec = Math.ceil(rem / 1000)
        if (wholeSec <= 5 && wholeSec >= 1 && lastTickSecRef.current !== wholeSec) {
          lastTickSecRef.current = wholeSec
          tick()
        }
      } else {
        setDisplayMs(now - anchorRef.current)
      }
    }, 200)
    return () => clearInterval(id)
  }, [running, modo])

  // Flash sólido enquanto "concluído" — alterna cores opacas (sem transparência).
  useEffect(() => {
    if (!done) {
      setFlashOn(false)
      return
    }
    const id = setInterval(() => setFlashOn((f) => !f), 450)
    return () => clearInterval(id)
  }, [done])

  function start() {
    unlockAudio()
    stopAlarm()
    setDone(false)
    lastTickSecRef.current = null
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
    stopAlarm()
    releaseWakeLock()
    lastTickSecRef.current = null
    setDisplayMs(modo === 'regressivo' ? baseSeconds * 1000 : 0)
  }

  function dismissDone() {
    stopAlarm()
    setDone(false)
    setDisplayMs(baseSeconds * 1000)
  }

  function addSeconds(sec: number) {
    stopAlarm()
    setDone(false)
    if (running) anchorRef.current += sec * 1000
    setDisplayMs((d) => Math.min(MAX_SECONDS * 1000, Math.max(0, d + sec * 1000)))
  }

  function setTime(mm: number, ss: number) {
    const total = Math.max(0, Math.min(MAX_SECONDS, mm * 60 + ss))
    setDisplayMs(total * 1000)
  }

  function trocarModo(m: Modo) {
    if (m === modo) return
    setRunning(false)
    setDone(false)
    stopAlarm()
    releaseWakeLock()
    lastTickSecRef.current = null
    setModo(m)
    setDisplayMs(m === 'regressivo' ? baseSeconds * 1000 : 0)
  }

  function fechar() {
    pause()
    stopAlarm()
    onClose()
  }

  if (!open) return null

  const tabCls = (m: Modo) =>
    `px-4 py-1.5 text-sm transition-colors ${
      modo === m ? 'bg-accent/15 text-accent-hover font-medium' : 'text-text-muted hover:text-text'
    }`

  const totalSec = Math.round(displayMs / 1000)
  const mm = Math.floor(totalSec / 60)
  const ss = totalSec % 60
  const alerta = displayMs <= 5000 && modo === 'regressivo' && running
  const idle = !running && !done

  const bgClass = done ? (flashOn ? 'bg-danger' : 'bg-accent') : 'bg-bg'

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex flex-col transition-colors duration-100 ${bgClass}`}
      onClick={done ? dismissDone : undefined}
    >
      <div className="flex items-center justify-between p-4">
        {done ? (
          <div />
        ) : (
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button type="button" onClick={() => trocarModo('regressivo')} className={tabCls('regressivo')}>
              Intervalo
            </button>
            <button type="button" onClick={() => trocarModo('progressivo')} className={tabCls('progressivo')}>
              Cronômetro
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            fechar()
          }}
          aria-label="Fechar cronômetro"
          className={`p-2 rounded-lg hover:bg-white/10 ${done ? 'text-white' : 'text-text-secondary hover:text-text'}`}
        >
          <X size={26} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
        {label && (
          <p
            className={`text-lg sm:text-2xl mb-2 text-center max-w-full truncate ${done ? 'text-white' : 'text-text-secondary'}`}
          >
            {label}
          </p>
        )}

        {done ? (
          <>
            <span className="font-display tabular-nums leading-none text-[26vw] sm:text-[16rem] text-white">
              00:00
            </span>
            <p className="mt-4 text-white font-display text-3xl sm:text-5xl font-bold">Intervalo concluído!</p>
          </>
        ) : running ? (
          <span
            className={`font-display tabular-nums leading-none text-[26vw] sm:text-[16rem] transition-colors ${
              alerta ? 'text-warning' : 'text-text'
            }`}
          >
            {fmt(displayMs)}
          </span>
        ) : (
          <>
            <div className="flex items-center justify-center gap-1 sm:gap-3" onClick={(e) => e.stopPropagation()}>
              <WheelNumber value={mm} max={99} ariaLabel="minutos" onChange={(m) => setTime(m, ss)} />
              <span className="font-display tabular-nums leading-none text-[12vw] sm:text-[7rem] text-text-muted">:</span>
              <WheelNumber value={ss} max={59} ariaLabel="segundos" onChange={(s) => setTime(mm, s)} />
            </div>
            <p className="mt-3 text-text-muted text-sm">Role ou use as setas para ajustar</p>
          </>
        )}
      </div>

      {idle && modo === 'regressivo' && (
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
        {done ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              dismissDone()
            }}
            className="px-12 py-4 rounded-full bg-white text-danger font-display text-xl font-bold shadow-lg"
          >
            Parar
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
