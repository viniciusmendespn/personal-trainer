import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { startAlarm, stopAlarm, startKeepAlive, stopKeepAlive, tick as tickBeep, unlockAudio } from '../../utils/beep'
import { useCronometroPiP, type PiPFrame } from '../../hooks/useCronometroPiP'
import {
  CronometroContext,
  CRONO_DEFAULT_SECONDS,
  CRONO_MAX_SECONDS,
  fmtCrono,
  type CronoModo,
} from './cronometroContext'
import { CronometroOverlay } from './CronometroOverlay'
import { CronometroPill } from './CronometroPill'

const STORAGE_KEY = 'pt_crono_state'

interface Snapshot {
  open: boolean
  minimized: boolean
  modo: CronoModo
  running: boolean
  done: boolean
  baseSeconds: number
  label?: string
  anchorMs: number
  displayMs: number
}

function resolveBase(seconds?: number): number {
  if (seconds === 0) return 0
  if (seconds != null && seconds > 0) return seconds
  return CRONO_DEFAULT_SECONDS
}

/**
 * Dono do relógio do cronômetro do app do aluno. Mantido acima das abas para o tempo sobreviver à
 * navegação e ao "minimizar" (registro de carga). O tick roda aqui — não no overlay — então a
 * contagem continua em qualquer tela e ao expandir/minimizar. Persiste em sessionStorage para
 * sobreviver a um reload. Renderiza o overlay (tela cheia) e a pílula flutuante.
 */
export function CronometroProvider({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<CronoModo>('regressivo')
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [displayMs, setDisplayMs] = useState(CRONO_DEFAULT_SECONDS * 1000)
  const [baseSeconds, setBaseSeconds] = useState(CRONO_DEFAULT_SECONDS)
  const [label, setLabel] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)

  // regressivo: instante-alvo do fim; progressivo: instante de início (epoch ms)
  const anchorRef = useRef(0)
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const lastTickSecRef = useRef<number | null>(null)
  const runTotalMsRef = useRef(CRONO_DEFAULT_SECONDS * 1000)

  const releaseWakeLock = useCallback(() => {
    try {
      void wakeRef.current?.release()
    } catch {
      /* noop */
    }
    wakeRef.current = null
  }, [])

  const requestWakeLock = useCallback(async () => {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }).wakeLock
      if (wl) wakeRef.current = await wl.request('screen')
    } catch {
      /* sem suporte / negado */
    }
  }, [])

  // ── Picture-in-Picture ────────────────────────────────────────────────────
  const getFrame = useCallback((): PiPFrame => {
    const alerta = displayMs <= 5000 && modo === 'regressivo' && running
    const fg = done ? '#a3e635' : alerta ? '#f59e0b' : '#e5e7eb'
    return { big: fmtCrono(displayMs), small: label, fg, bg: '#0a0a0a' }
  }, [displayMs, modo, running, done, label])
  const pip = useCronometroPiP(getFrame)

  // ── Tick principal — recalcula a partir de Date.now() (sem acumular drift) ──
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
          stopKeepAlive()
          startAlarm()
          navigator.vibrate?.([200, 100, 200])
          return
        }
        setDisplayMs(rem)
        const wholeSec = Math.ceil(rem / 1000)
        if (wholeSec <= 5 && wholeSec >= 1 && lastTickSecRef.current !== wholeSec) {
          lastTickSecRef.current = wholeSec
          tickBeep()
        }
      } else {
        setDisplayMs(now - anchorRef.current)
      }
    }, 200)
    return () => clearInterval(id)
  }, [running, modo, releaseWakeLock])

  // Re-adquire wake lock e destrava áudio ao voltar do background.
  useEffect(() => {
    if (!running) return
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock()
        unlockAudio()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [running, requestWakeLock])

  // MediaSession: sinaliza ao SO que estamos tocando mídia (reduz throttling em foreground).
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    try {
      if (running) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: 'Cronômetro', artist: label || 'CoachPilot' })
        navigator.mediaSession.playbackState = 'playing'
      } else {
        navigator.mediaSession.playbackState = 'paused'
      }
    } catch {
      /* noop */
    }
  }, [running, label])

  // ── Persistência (sessionStorage) ──────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    const snap: Snapshot = { open, minimized, modo, running, done, baseSeconds, label, anchorMs: anchorRef.current, displayMs }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap))
    } catch {
      /* noop */
    }
    // displayMs fora das deps de propósito: enquanto corre, restauramos pela âncora, não pelo valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, minimized, modo, running, done, baseSeconds, label])

  // Restaura ao montar (sobrevive a reload da PWA).
  useEffect(() => {
    let snap: Snapshot | null = null
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) snap = JSON.parse(raw) as Snapshot
    } catch {
      snap = null
    }
    if (!snap || !snap.open) return
    setModo(snap.modo)
    setBaseSeconds(snap.baseSeconds)
    setLabel(snap.label)
    setMinimized(snap.minimized)
    setOpen(true)
    runTotalMsRef.current = snap.baseSeconds * 1000
    if (snap.running) {
      const now = Date.now()
      if (snap.modo === 'regressivo') {
        const rem = snap.anchorMs - now
        if (rem <= 0) {
          setDone(true)
          setDisplayMs(0)
        } else {
          anchorRef.current = snap.anchorMs
          setDisplayMs(rem)
          setRunning(true)
        }
      } else {
        anchorRef.current = snap.anchorMs
        setDisplayMs(now - snap.anchorMs)
        setRunning(true)
      }
    } else {
      setDone(snap.done)
      setDisplayMs(snap.displayMs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Ações ───────────────────────────────────────────────────────────────────
  const abrir = useCallback((seconds?: number, label?: string) => {
    const base = resolveBase(seconds)
    stopAlarm()
    stopKeepAlive()
    releaseWakeLock()
    lastTickSecRef.current = null
    runTotalMsRef.current = base * 1000
    setModo('regressivo')
    setRunning(false)
    setDone(false)
    setDisplayMs(base * 1000)
    setBaseSeconds(base)
    setLabel(label)
    setMinimized(false)
    setOpen(true)
  }, [releaseWakeLock])

  const iniciar = useCallback(() => {
    unlockAudio()
    stopAlarm()
    startKeepAlive()
    setDone(false)
    lastTickSecRef.current = null
    setDisplayMs((d) => {
      runTotalMsRef.current = d
      const now = Date.now()
      anchorRef.current = modo === 'regressivo' ? now + d : now - d
      return d
    })
    setRunning(true)
    void requestWakeLock()
  }, [modo, requestWakeLock])

  const pausar = useCallback(() => {
    setRunning(false)
    releaseWakeLock()
    stopKeepAlive()
  }, [releaseWakeLock])

  const resetar = useCallback(() => {
    setRunning(false)
    setDone(false)
    stopAlarm()
    releaseWakeLock()
    stopKeepAlive()
    lastTickSecRef.current = null
    setDisplayMs(modo === 'regressivo' ? baseSeconds * 1000 : 0)
  }, [modo, baseSeconds, releaseWakeLock])

  const dismiss = useCallback(() => {
    stopAlarm()
    setDone(false)
    setDisplayMs(baseSeconds * 1000)
  }, [baseSeconds])

  const addSeconds = useCallback((sec: number) => {
    stopAlarm()
    setDone(false)
    setRunning((r) => {
      if (r) {
        anchorRef.current += sec * 1000
        runTotalMsRef.current += sec * 1000
      }
      return r
    })
    setDisplayMs((d) => Math.min(CRONO_MAX_SECONDS * 1000, Math.max(0, d + sec * 1000)))
  }, [])

  const trocarModo = useCallback((m: CronoModo) => {
    setModo((cur) => {
      if (m === cur) return cur
      setRunning(false)
      setDone(false)
      stopAlarm()
      releaseWakeLock()
      stopKeepAlive()
      lastTickSecRef.current = null
      setDisplayMs(m === 'regressivo' ? baseSeconds * 1000 : 0)
      return m
    })
  }, [baseSeconds, releaseWakeLock])

  const setDisplaySeconds = useCallback((s: number) => setDisplayMs(Math.max(0, s) * 1000), [])

  const minimizar = useCallback(() => setMinimized(true), [])
  const expandir = useCallback(() => setMinimized(false), [])

  const fechar = useCallback(() => {
    setRunning(false)
    setDone(false)
    stopAlarm()
    releaseWakeLock()
    stopKeepAlive()
    void pip.exit()
    setOpen(false)
    setMinimized(false)
  }, [releaseWakeLock, pip])

  const togglePiP = useCallback(() => {
    if (pip.active) void pip.exit()
    else void pip.enter()
  }, [pip])

  return (
    <CronometroContext.Provider
      value={{
        open,
        minimized,
        modo,
        running,
        done,
        displayMs,
        baseSeconds,
        label,
        runTotalMs: runTotalMsRef.current,
        abrir,
        expandir,
        minimizar,
        fechar,
        iniciar,
        pausar,
        resetar,
        dismiss,
        addSeconds,
        trocarModo,
        setDisplaySeconds,
        pipSupported: pip.supported,
        pipActive: pip.active,
        togglePiP,
      }}
    >
      {children}
      {open && !minimized && <CronometroOverlay />}
      {open && minimized && <CronometroPill />}
    </CronometroContext.Provider>
  )
}
