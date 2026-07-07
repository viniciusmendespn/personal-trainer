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

/** Configuração do timer de WOD (spec CROSSFIT §3.3) — camada opcional sobre o engine
 * regressivo/progressivo: FOR_TIME conta pra cima com time cap; AMRAP conta pra baixo com
 * contador de rounds; EMOM conta pra cima com beep a cada intervalo e slot do minuto. */
export interface WodConfig {
  formato: 'FOR_TIME' | 'AMRAP' | 'EMOM'
  blocoId: string
  blocoNome?: string
  timeCapS?: number      // FOR_TIME
  duracaoS?: number      // AMRAP/EMOM: duração total
  intervaloS?: number    // EMOM (default 60)
  slots?: string[]       // EMOM: nomes dos exercícios por minuto (cicla)
}

/** Resultado capturado pelo timer — pré-preenche o modal de score na finalização. */
export interface WodResultado {
  blocoId: string
  tempoS?: number        // FOR_TIME ("Terminei!")
  rounds?: number        // AMRAP
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
  wod?: WodConfig
  wodRounds: number
  wodResultado?: WodResultado
}

export interface CronometroContextValue extends CronometroState {
  /** Abre uma NOVA sessão de cronômetro (reseta), overlay expandido. */
  abrir: (seconds?: number, label?: string) => void
  /** Abre o timer de WOD pré-configurado com os parâmetros do bloco. */
  abrirWod: (cfg: WodConfig) => void
  /** AMRAP: incrementa o contador de rounds. */
  addRound: () => void
  /** FOR_TIME: para o relógio e captura o tempo como resultado. */
  terminarWod: () => void
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
