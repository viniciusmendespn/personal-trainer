// Alerta sonoro do cronômetro via Web Audio API — sem asset de áudio.
// O AudioContext precisa ser criado/retomado dentro de um gesto do usuário
// (ex.: ao tocar em "Iniciar") para contornar a política de autoplay dos browsers.

let ctx: AudioContext | null = null

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

function tone(c: AudioContext, start: number, freq: number, dur: number): void {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(start)
  osc.stop(start + dur)
}

/** Toca uma sequência de 3 bipes — alerta de fim de intervalo. */
export function playAlarm(): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  const now = c.currentTime
  tone(c, now, 880, 0.18)
  tone(c, now + 0.28, 880, 0.18)
  tone(c, now + 0.56, 1175, 0.34)
}
