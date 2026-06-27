// Alerta sonoro do cronômetro via Web Audio API — sem asset de áudio.
// O AudioContext precisa ser criado/retomado dentro de um gesto do usuário
// (ex.: ao tocar em "Iniciar") para contornar a política de autoplay dos browsers.

let ctx: AudioContext | null = null

// Estado do alarme contínuo (sirene) — variáveis de módulo para garantir 1 só por vez.
let alarmOsc: OscillatorNode | null = null
let alarmGain: GainNode | null = null
let sirenTimer: number | null = null
let safetyTimer: number | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  return ctx
}

/** Libera o áudio. Chamar dentro de um gesto do usuário (ex.: no "Iniciar"). */
export function unlockAudio(): void {
  const c = getCtx()
  if (c && c.state === 'suspended') void c.resume()
}

function tone(c: AudioContext, start: number, freq: number, dur: number, peak = 0.4): void {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(start)
  osc.stop(start + dur)
}

/** Bip curto e seco — usado a cada segundo nos últimos 5 s da contagem. */
export function tick(): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  tone(c, c.currentTime, 1000, 0.07, 0.5)
}

/** Alarme alto e contínuo (sirene de dois tons) até `stopAlarm()`. */
export function startAlarm(): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  stopAlarm() // nunca empilha dois alarmes

  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(880, c.currentTime)
  gain.gain.setValueAtTime(0.55, c.currentTime)
  osc.connect(gain).connect(c.destination)
  osc.start()
  alarmOsc = osc
  alarmGain = gain

  let high = false
  sirenTimer = window.setInterval(() => {
    if (!alarmOsc || !ctx) return
    high = !high
    alarmOsc.frequency.setValueAtTime(high ? 1175 : 740, ctx.currentTime)
  }, 350)

  // Segurança: para sozinho após 30 s caso nada o interrompa.
  safetyTimer = window.setTimeout(() => stopAlarm(), 30000)
}

/** Silencia o alarme contínuo. Idempotente. */
export function stopAlarm(): void {
  if (sirenTimer != null) {
    clearInterval(sirenTimer)
    sirenTimer = null
  }
  if (safetyTimer != null) {
    clearTimeout(safetyTimer)
    safetyTimer = null
  }
  if (alarmOsc && alarmGain && ctx) {
    try {
      const now = ctx.currentTime
      alarmGain.gain.setTargetAtTime(0.0001, now, 0.02) // fade rápido evita clique
      alarmOsc.stop(now + 0.1)
    } catch {
      /* noop */
    }
  }
  alarmOsc = null
  alarmGain = null
}
