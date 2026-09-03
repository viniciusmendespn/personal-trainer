import { describe, it, expect } from 'vitest'
import {
  civilNoFuso, diaIsoNoFuso, diaLocal, diaLocalIso, diaNoFuso,
  horaNoFuso, instanteDeCivil, limitesDiaLocal,
} from './datetime'

const SP = 'America/Sao_Paulo'
const TOKYO = 'Asia/Tokyo'
const NY = 'America/New_York'

describe('diaNoFuso / horaNoFuso', () => {
  it('o mesmo instante é dia 7 em SP e dia 8 em Tóquio', () => {
    const inicio = '2026-09-08T02:30:00Z'          // 23h30 do dia 7 em SP
    expect(diaIsoNoFuso(inicio, SP)).toBe('2026-09-07')
    expect(diaIsoNoFuso(inicio, TOKYO)).toBe('2026-09-08')
  })

  it('compromisso das 21h no BRT não vaza para o dia seguinte', () => {
    expect(diaIsoNoFuso('2026-09-08T00:30:00Z', SP)).toBe('2026-09-07')
  })

  it('não confunde meia-noite com o dia seguinte', () => {
    // `hour: '2-digit'` devolve 24 à meia-noite em alguns engines — se não normalizasse,
    // a data pularia um dia justo na virada.
    expect(diaIsoNoFuso('2026-09-08T03:00:00Z', SP)).toBe('2026-09-08')
    expect(horaNoFuso('2026-09-08T03:00:00Z', SP)).toBe('00:00')
  })

  it('respeita o horário de verão pelo nome IANA', () => {
    expect(horaNoFuso('2026-01-15T17:00:00Z', NY)).toBe('12:00')   // EST, -5
    expect(horaNoFuso('2026-07-15T17:00:00Z', NY)).toBe('13:00')   // EDT, -4
  })

  it('fuso inválido degrada para o dia do aparelho em vez de quebrar', () => {
    const d = new Date(2026, 7, 20, 15)
    expect(diaNoFuso(d, 'Marte/Olympus')).toBe(diaLocal(d))
    expect(diaNoFuso(d, null)).toBe(diaLocal(d))
  })
})

describe('instanteDeCivil', () => {
  it('21h em São Paulo vira o instante UTC correto', () => {
    expect(instanteDeCivil('2026-09-07', '21:00', SP)).toBe('2026-09-08T00:00:00.000Z')
  })

  it('a mesma hora civil em fusos diferentes dá instantes diferentes', () => {
    expect(instanteDeCivil('2026-09-07', '08:00', TOKYO)).toBe('2026-09-06T23:00:00.000Z')
    expect(instanteDeCivil('2026-09-07', '08:00', SP)).toBe('2026-09-07T11:00:00.000Z')
  })

  it('acerta os dois lados de uma virada de horário de verão', () => {
    // Nova York: -5 em janeiro, -4 em julho. Offset fixo erraria metade do ano.
    expect(instanteDeCivil('2026-01-15', '09:00', NY)).toBe('2026-01-15T14:00:00.000Z')
    expect(instanteDeCivil('2026-07-15', '09:00', NY)).toBe('2026-07-15T13:00:00.000Z')
  })

  it('é a inversa exata de civilNoFuso', () => {
    for (const tz of [SP, TOKYO, NY]) {
      for (const [data, hora] of [['2026-06-15', '21:00'], ['2026-01-02', '00:00'], ['2026-11-01', '01:30']]) {
        const iso = instanteDeCivil(data, hora, tz)
        expect(civilNoFuso(iso, tz)).toEqual([data, hora])
      }
    }
  })

  it('hora inexistente na virada do horário de verão não quebra, escorrega', () => {
    // 08/03/2026 em Nova York: o relógio pula de 02:00 para 03:00, então 02:30 NÃO EXISTE.
    // Não há resposta certa — o que importa é ser determinístico e não estourar. Cai em 01:30,
    // e o compromisso fica no dia certo. (Só alcançável escolhendo essa hora à mão nos EUA.)
    const iso = instanteDeCivil('2026-03-08', '02:30', NY)
    expect(diaIsoNoFuso(iso, NY)).toBe('2026-03-08')
    expect(horaNoFuso(iso, NY)).toBe('01:30')
  })
})

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
