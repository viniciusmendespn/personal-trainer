import { describe, it, expect } from 'vitest'
import { fmtSerieExecutada } from './serie'

const FORCA = { tipo: 'FORCA' } as const
const PERF = { tipo: 'PERFORMANCE' } as const

describe('unidade ausente', () => {
  // O backend grava `null` (não `undefined`) para FORÇA, onde kg/reps são implícitos. Com `??`
  // isso renderizava a unidade literal "null" — o bug que motivou a fonte única.
  it('cai no padrão kg/reps quando a unidade vem null', () => {
    expect(fmtSerieExecutada({ carga: '60', reps: 10 }, { ...FORCA, unidadeCarga: null, unidadeReps: null }))
      .toBe('10 reps · 60 kg')
  })

  it('cai no padrão quando a unidade vem string vazia', () => {
    expect(fmtSerieExecutada({ carga: '60', reps: 10 }, { ...FORCA, unidadeCarga: '', unidadeReps: '' }))
      .toBe('10 reps · 60 kg')
  })

  it('respeita a unidade quando ela existe', () => {
    expect(fmtSerieExecutada({ carga: '20', reps: 12 }, { ...FORCA, unidadeCarga: 'lb', unidadeReps: 'rep' }))
      .toBe('12 rep · 20 lb')
  })
})

describe('FORÇA', () => {
  it('mostra só as reps quando não há carga', () => {
    expect(fmtSerieExecutada({ reps: 15 }, FORCA)).toBe('15 reps')
  })

  it('aceita carga negativa (contrapeso/graviton)', () => {
    expect(fmtSerieExecutada({ carga: '-30', reps: 8 }, FORCA)).toBe('8 reps · -30 kg')
  })

  it('não inventa número quando não há nada registrado', () => {
    expect(fmtSerieExecutada({}, FORCA)).toBe('—')
  })
})

describe('PERFORMANCE', () => {
  it('usa a métrica livre no lugar das reps', () => {
    expect(fmtSerieExecutada({ reps: 5 }, { ...PERF, unidadeReps: 'km' })).toBe('5 km')
  })

  it('trata a carga como 2ª medida de contexto', () => {
    expect(fmtSerieExecutada({ reps: 5, carga: '25' }, { ...PERF, unidadeReps: 'km', unidadeCarga: 'min' }))
      .toBe('5 km · 25 min')
  })

  it('omite a unidade de carga quando ela não foi definida', () => {
    expect(fmtSerieExecutada({ reps: 5, carga: '25' }, { ...PERF, unidadeReps: 'km' })).toBe('5 km · 25')
  })
})

describe('anotação de contexto (bloco de WOD)', () => {
  it('vira "carga usada" — o resultado oficial é o score do bloco', () => {
    expect(fmtSerieExecutada({ carga: '35', contexto: true }, FORCA)).toBe('Carga usada: 35 kg')
  })

  it('série sem reps mas com carga também é anotação', () => {
    expect(fmtSerieExecutada({ carga: '35' }, FORCA)).toBe('Carga usada: 35 kg')
  })

  it('anotação vazia não vira "undefined"', () => {
    expect(fmtSerieExecutada({ contexto: true }, FORCA)).toBe('—')
  })
})
