import { describe, it, expect } from 'vitest'
import { decodeScoreValor, encodeScoreValor, fmtScoreValor } from './wod'

/** O score de WOD é guardado como um número ordenável. A codificação vive em dois lugares —
 * aqui e em `_processar_scores_wod` no backend — então o mínimo que dá para travar no front é
 * a ida e volta: editar um recorde não pode alterar o formato do valor. */
describe('ida e volta do score ordenável', () => {
  it('FOR_TIME guarda segundos', () => {
    expect(encodeScoreValor('FOR_TIME', { tempo_s: 512 })).toBe(512)
    expect(decodeScoreValor('FOR_TIME', 512)).toEqual({ tempo_s: 512 })
    expect(fmtScoreValor('FOR_TIME', 512)).toBe('8:32')
  })

  it('AMRAP guarda rounds*1000 + reps', () => {
    expect(encodeScoreValor('AMRAP', { rounds: 7, reps_extras: 12 })).toBe(7012)
    expect(decodeScoreValor('AMRAP', 7012)).toEqual({ rounds: 7, reps_extras: 12 })
  })

  it('EMOM guarda minutos', () => {
    expect(encodeScoreValor('EMOM', { minutos_completos: 14 })).toBe(14)
    expect(decodeScoreValor('EMOM', 14)).toEqual({ minutos_completos: 14 })
  })

  it('sobrevive ao ciclo decode → encode em todos os formatos', () => {
    for (const [formato, valor] of [['FOR_TIME', 512], ['AMRAP', 7012], ['EMOM', 14]] as const) {
      expect(encodeScoreValor(formato, decodeScoreValor(formato, valor))).toBe(valor)
    }
  })
})

describe('entradas incompletas não viram score', () => {
  it('FOR_TIME sem tempo', () => {
    expect(encodeScoreValor('FOR_TIME', { tempo_s: 0 })).toBeNull()
    expect(encodeScoreValor('FOR_TIME', {})).toBeNull()
  })

  it('AMRAP sem rounds nem reps', () => {
    expect(encodeScoreValor('AMRAP', {})).toBeNull()
  })

  it('AMRAP só com rounds conta como zero reps extras', () => {
    expect(encodeScoreValor('AMRAP', { rounds: 3 })).toBe(3000)
  })

  it('EMOM aceita zero minutos, mas não a ausência', () => {
    expect(encodeScoreValor('EMOM', { minutos_completos: 0 })).toBe(0)
    expect(encodeScoreValor('EMOM', {})).toBeNull()
  })

  it('formato desconhecido não inventa valor', () => {
    expect(encodeScoreValor(undefined, { tempo_s: 512 })).toBeNull()
    expect(decodeScoreValor('LIVRE', 512)).toEqual({})
  })
})
