import { describe, it, expect } from 'vitest'
import { diaLocal, diaLocalIso, limitesDiaLocal } from './datetime'

/** O recorte é sempre no fuso do aparelho — é isso que o backend NÃO assume. */
const OFFSET_MIN = new Date('2026-08-20T12:00:00Z').getTimezoneOffset()

describe('diaLocal', () => {
  it('não vira o dia à noite, mesmo quando o dia UTC já virou', () => {
    // O compromisso das 21h de terça é de terça. Em BRT, 21h local é 00h UTC de quarta.
    for (const hora of [0, 12, 21, 23]) {
      expect(diaLocal(new Date(2026, 7, 18, hora, 30))).toBe('2026-08-18')
    }
  })

  it('a chave do instante bate com a chave da célula do dia', () => {
    // O bug da agenda era exatamente este par não fechar: `porDia` agrupava o compromisso
    // pelo dia UTC (slice da string ISO) e a grade procurava pelo dia local.
    const compromisso = new Date(2026, 7, 18, 21, 30)
    const celulaDaTerca = new Date(2026, 7, 18, 0, 0)
    expect(diaLocalIso(compromisso.toISOString())).toBe(diaLocal(celulaDaTerca))
  })

  it('toISOString().slice(0,10) NÃO serve como chave de dia local', () => {
    // Trava a regressão: é a forma antiga, e ela diverge em qualquer fuso a oeste de UTC-3.
    const noite = new Date(2026, 7, 18, 21, 30)
    if (OFFSET_MIN >= 180) expect(noite.toISOString().slice(0, 10)).not.toBe(diaLocal(noite))
  })

  it('zera à esquerda mês e dia', () => {
    expect(diaLocal(new Date(2026, 0, 5, 10))).toBe('2026-01-05')
  })
})

describe('diaLocalIso', () => {
  it('devolve o dia local no formato YYYY-MM-DD', () => {
    const d = new Date(2026, 7, 20, 15, 30)
    expect(diaLocalIso(d.toISOString())).toBe('2026-08-20')
  })

  it('agrupa dois instantes do mesmo dia local na mesma chave', () => {
    const manha = new Date(2026, 7, 20, 6, 0).toISOString()
    const noite = new Date(2026, 7, 20, 23, 30).toISOString()
    expect(diaLocalIso(manha)).toBe(diaLocalIso(noite))
  })

  it('separa a virada do dia local', () => {
    const antes = new Date(2026, 7, 20, 23, 59).toISOString()
    const depois = new Date(2026, 7, 21, 0, 1).toISOString()
    expect(diaLocalIso(antes)).not.toBe(diaLocalIso(depois))
  })
})

describe('limitesDiaLocal', () => {
  it('cobre exatamente 24h', () => {
    const { inicio, fim } = limitesDiaLocal(new Date(2026, 7, 20, 15).toISOString())
    expect(new Date(fim).getTime() - new Date(inicio).getTime()).toBe(24 * 3600 * 1000)
  })

  it('começa na meia-noite local, não na meia-noite UTC', () => {
    const { inicio } = limitesDiaLocal(new Date(2026, 7, 20, 15).toISOString())
    const d = new Date(inicio)
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0])
    // Só coincide com UTC em fuso zero — é justamente o que a função existe para evitar.
    if (OFFSET_MIN !== 0) expect(inicio.slice(11, 16)).not.toBe('00:00')
  })

  it('põe um treino tarde da noite no dia em que o aluno treinou', () => {
    // 23h local: em BRT isso é 02h UTC do dia seguinte — recortar por UTC traria o dia errado.
    const noite = new Date(2026, 7, 20, 23, 0).toISOString()
    const { inicio, fim } = limitesDiaLocal(noite)
    expect(noite >= inicio && noite < fim).toBe(true)
    expect(diaLocalIso(inicio)).toBe('2026-08-20')
  })

  it('é o mesmo intervalo para qualquer instante do mesmo dia local', () => {
    const a = limitesDiaLocal(new Date(2026, 7, 20, 0, 5).toISOString())
    const b = limitesDiaLocal(new Date(2026, 7, 20, 23, 55).toISOString())
    expect(a).toEqual(b)
  })

  it('o fim é exclusivo: encosta no início do dia seguinte', () => {
    const dia20 = limitesDiaLocal(new Date(2026, 7, 20, 12).toISOString())
    const dia21 = limitesDiaLocal(new Date(2026, 7, 21, 12).toISOString())
    expect(dia20.fim).toBe(dia21.inicio)
  })
})
