import { createContext, useContext } from 'react'

export type CronoModo = 'regressivo' | 'progressivo'

export const CRONO_DEFAULT_SECONDS = 90 // padrão (1:30) quando o personal não cadastrou intervalo
export const CRONO_MAX_SECONDS = 99 * 60 + 59

/** Formata ms → "mm:ss" (arredonda pra cima; nunca negativo). */
export function fmtCrono(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export interface CronometroState {
  open: boolean
  minimized: boolean
  modo: CronoModo
  running: boolean
  done: boolean
  displayMs: number
  baseSeconds: number
  label?: string
}

export interface CronometroContextValue extends CronometroState {
  /** Abre uma NOVA sessão de cronômetro (reseta), overlay expandido. */
  abrir: (seconds?: number, label?: string) => void
  /** Expande o overlay a partir da pílula (sem resetar). */
  expandir: () => void
  /** Minimiza para a pílula (continua contando). */
  minimizar: () => void
  /** Encerra a sessão (para tudo). */
  fechar: () => void
  iniciar: () => void
  pausar: () => void
  resetar: () => void
  dismiss: () => void
  addSeconds: (sec: number) => void
  trocarModo: (m: CronoModo) => void
  setDisplaySeconds: (s: number) => void
  runTotalMs: number
  // Picture-in-Picture
  pipSupported: boolean
  pipActive: boolean
  togglePiP: () => void
}

export const CronometroContext = createContext<CronometroContextValue | null>(null)

export function useCronometro(): CronometroContextValue {
  const ctx = useContext(CronometroContext)
  if (!ctx) throw new Error('useCronometro deve ser usado dentro de <CronometroProvider>')
  return ctx
}
