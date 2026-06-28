// Alerta sonoro do cronômetro via Web Audio API — sem asset de áudio.
// O AudioContext precisa ser criado/retomado dentro de um gesto do usuário
// (ex.: ao tocar em "Iniciar") para contornar a política de autoplay dos browsers.

let ctx: AudioContext | null = null

// Estado do alarme — timers de módulo para garantir 1 só por vez.
let alarmTimer: number | null = null
let safetyTimer: number | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (ctx?.state === 'closed') ctx = null
  if (!ctx) ctx = new AC()
  return ctx
}

/**
 * Libera o áudio. Chamar dentro de um gesto do usuário (ex.: no "Iniciar").
 * No iOS/Safari, além de `resume()`, é preciso tocar um som dentro do gesto para
 * destravar a reprodução de sons agendados depois (setInterval/setTimeout).
 */
export function unlockAudio(): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  tone(c, c.currentTime + 0.05, 440, 0.05, 0.001)
}

function tone(c: AudioContext, start: number, freq: number, dur: number, peak = 0.4): void {
  try {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(gain).connect(c.destination)
    osc.start(start)
    osc.stop(start + dur)
  } catch { /* noop */ }
}

/** Bip curto e seco — usado a cada segundo nos últimos 5 s da contagem. */
export function tick(): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  tone(c, c.currentTime + 0.05, 900, 0.06, 0.28)
}

/**
 * Alarme meio-termo: um bipe-duplo gentil (sine) que repete a cada ~0.9 s, por até
 * ~10 s ou até `stopAlarm()`. Mais presente que 1 bipe, sem a sirene contínua agressiva.
 */
export function startAlarm(): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  stopAlarm() // nunca empilha dois alarmes

  const burst = () => {
    const t = c.currentTime + 0.05
    tone(c, t, 880, 0.13, 0.32)
    tone(c, t + 0.18, 1175, 0.16, 0.32)
  }
  burst()
  alarmTimer = window.setInterval(burst, 900)
  safetyTimer = window.setTimeout(() => stopAlarm(), 10000)
}

/** Silencia o alarme. Idempotente. */
export function stopAlarm(): void {
  if (alarmTimer != null) {
    clearInterval(alarmTimer)
    alarmTimer = null
  }
  if (safetyTimer != null) {
    clearTimeout(safetyTimer)
    safetyTimer = null
  }
}
