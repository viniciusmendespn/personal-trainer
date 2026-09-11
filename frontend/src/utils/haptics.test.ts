import { describe, it, expect, vi, afterEach } from 'vitest'
import { vibrar, hapticsSuportado } from './haptics'

/**
 * Não há jsdom (vitest.config.ts usa environment:'node'), então `navigator` é stubado na mão —
 * o que de quebra prova que o módulo não depende de mais nada do DOM.
 */
function stubVibrate(impl: () => boolean = () => true) {
  const vibrate = vi.fn(impl)
  vi.stubGlobal('navigator', { vibrate } as unknown as Navigator)
  return vibrate
}

describe('haptics', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sem navigator.vibrate vira no-op, não lança', () => {
    vi.stubGlobal('navigator', {} as unknown as Navigator)
    expect(hapticsSuportado()).toBe(false)
    expect(() => vibrar('alerta')).not.toThrow()
    expect(vibrar('alerta')).toBe(false)
  })

  // Trava de regressão: estes quatro padrões vieram do CronometroProvider e definem a
  // sensação de fim de intervalo do app. Mudar aqui é mudar o produto, não refatorar.
  it('mantém os padrões que já existiam no cronômetro', () => {
    const vibrate = stubVibrate()
    vibrar('sucesso')
    expect(vibrate).toHaveBeenLastCalledWith(80)
    vibrar('virada')
    expect(vibrate).toHaveBeenLastCalledWith([120, 60, 120])
    vibrar('alerta')
    expect(vibrate).toHaveBeenLastCalledWith([200, 100, 200])
    vibrar('urgente')
    expect(vibrate).toHaveBeenLastCalledWith([300, 100, 300, 100, 300])
  })

  it('os níveis de gesto são curtos — tap, não zumbido', () => {
    const vibrate = stubVibrate()
    vibrar('toque')
    expect(vibrate).toHaveBeenLastCalledWith(10)
    vibrar('impacto')
    expect(vibrate).toHaveBeenLastCalledWith(25)
  })

  it('propaga o false da API (documento oculto / sem user activation)', () => {
    stubVibrate(() => false)
    expect(vibrar('alerta')).toBe(false)
  })

  it('vibrate que lança não derruba o chamador', () => {
    stubVibrate(() => {
      throw new Error('blocked')
    })
    expect(() => vibrar('toque')).not.toThrow()
    expect(vibrar('toque')).toBe(false)
  })
})
