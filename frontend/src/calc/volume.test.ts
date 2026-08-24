import { describe, it, expect } from 'vitest'
import { calcularVolume, classificarVolume, FAIXAS, GRUPO_LABELS, PROVENIENCIA_VOLUME } from './volume'
import type { GrupoMuscular } from './volume'

function ok(r: ReturnType<typeof calcularVolume>) {
  if (!r.ok) throw new Error(`esperava ok: ${r.avisos.map((a) => a.mensagem).join(' | ')}`)
  return r
}

function series(g: ReturnType<typeof calcularVolume>, grupo: GrupoMuscular) {
  if (!g.ok) throw new Error('esperava ok')
  return g.resultado.grupos.find((x) => x.grupo === grupo)!
}

describe('calcularVolume — contas conferidas', () => {
  it('4 diretas × 2 sessões = 8 séries, mínimo efetivo', () => {
    const r = ok(calcularVolume({ grupos: [{ grupo: 'peito', seriesDiretasPorSessao: 4, frequenciaSemanal: 2 }] }))
    const peito = series(r, 'peito')
    expect(peito.seriesEfetivasSemana).toBe(8)
    expect(peito.faixa).toBe('minimo_efetivo')
    expect(peito.seriesAteFaixaAlvo).toBe(2)
  })

  it('2 diretas + 6 indiretas × 2 sessões = 10 séries com o fator 0,5', () => {
    const r = ok(calcularVolume({ grupos: [{ grupo: 'triceps', seriesDiretasPorSessao: 2, seriesIndiretasPorSessao: 6, frequenciaSemanal: 2 }] }))
    const t = series(r, 'triceps')
    expect(t.seriesEfetivasSemana).toBe(10)
    expect(t.faixa).toBe('faixa_alvo')
    expect(t.seriesAteFaixaAlvo).toBe(0)
  })

  it('o fator é parâmetro: com 1,0 o mesmo tríceps vai a 16', () => {
    const r = ok(calcularVolume({
      grupos: [{ grupo: 'triceps', seriesDiretasPorSessao: 2, seriesIndiretasPorSessao: 6, frequenciaSemanal: 2 }],
      fatorSerieIndireta: 1,
    }))
    expect(series(r, 'triceps').seriesEfetivasSemana).toBe(16)
  })

  it('só indiretas: 9 × 0,5 × 2 = 9', () => {
    const r = ok(calcularVolume({ grupos: [{ grupo: 'biceps', seriesDiretasPorSessao: 0, seriesIndiretasPorSessao: 9, frequenciaSemanal: 2 }] }))
    expect(series(r, 'biceps').seriesEfetivasSemana).toBe(9)
    expect(series(r, 'biceps').faixa).toBe('minimo_efetivo')
  })

  it('volume baixo dispara o aviso', () => {
    const r = ok(calcularVolume({ grupos: [{ grupo: 'panturrilhas', seriesDiretasPorSessao: 2, frequenciaSemanal: 1 }] }))
    expect(series(r, 'panturrilhas').faixa).toBe('abaixo_do_minimo')
    expect(r.avisos.map((a) => a.codigo)).toContain('VOLUME_ABAIXO_DO_MINIMO')
  })

  it('grupo repetido agrega em vez de duplicar', () => {
    const r = ok(calcularVolume({
      grupos: [
        { grupo: 'peito', seriesDiretasPorSessao: 4, frequenciaSemanal: 2 },
        { grupo: 'peito', seriesDiretasPorSessao: 2, frequenciaSemanal: 1 },
      ],
    }))
    expect(r.resultado.grupos).toHaveLength(1)
    expect(series(r, 'peito').seriesEfetivasSemana).toBe(10)
  })
})

describe('fronteiras das faixas', () => {
  it('4,9 e 5,0 caem em faixas diferentes', () => {
    expect(classificarVolume(4.9).faixa).toBe('abaixo_do_minimo')
    expect(classificarVolume(5).faixa).toBe('minimo_efetivo')
  })

  it('9,9 e 10,0 caem em faixas diferentes', () => {
    expect(classificarVolume(9.9).faixa).toBe('minimo_efetivo')
    expect(classificarVolume(10).faixa).toBe('faixa_alvo')
  })

  it('as faixas são contíguas e começam em zero', () => {
    expect(FAIXAS[0].min).toBe(0)
    for (let i = 0; i < FAIXAS.length - 1; i++) expect(FAIXAS[i].max).toBe(FAIXAS[i + 1].min)
    expect(FAIXAS[FAIXAS.length - 1].max).toBe(Infinity)
  })
})

describe('ganho relativo estimado', () => {
  it('extrapola 0,38% por série sobre a base de 5', () => {
    const dez = ok(calcularVolume({ grupos: [{ grupo: 'peito', seriesDiretasPorSessao: 10, frequenciaSemanal: 1 }] }))
    expect(series(dez, 'peito').ganhoRelativoEstimadoPct).toBeCloseTo(1.9, 4)
    const vinte = ok(calcularVolume({ grupos: [{ grupo: 'peito', seriesDiretasPorSessao: 20, frequenciaSemanal: 1 }] }))
    expect(series(vinte, 'peito').ganhoRelativoEstimadoPct).toBeCloseTo(5.7, 4)
  })

  it('não extrapola fora de 5 a 20 séries', () => {
    const quatro = ok(calcularVolume({ grupos: [{ grupo: 'peito', seriesDiretasPorSessao: 4, frequenciaSemanal: 1 }] }))
    expect(series(quatro, 'peito').ganhoRelativoEstimadoPct).toBeNull()
    const vinteSeis = ok(calcularVolume({ grupos: [{ grupo: 'peito', seriesDiretasPorSessao: 26, frequenciaSemanal: 1 }] }))
    expect(series(vinteSeis, 'peito').ganhoRelativoEstimadoPct).toBeNull()
    expect(vinteSeis.avisos.map((a) => a.codigo)).toContain('VOLUME_ALEM_DA_EVIDENCIA')
  })
})

describe('honestidade sobre a convenção do fator', () => {
  it('todo resultado carrega o aviso de que 0,5 é convenção do produto', () => {
    const casos = [
      [{ grupo: 'peito' as GrupoMuscular, seriesDiretasPorSessao: 4, frequenciaSemanal: 2 }],
      [{ grupo: 'costas' as GrupoMuscular, seriesDiretasPorSessao: 12, frequenciaSemanal: 2 }],
      [{ grupo: 'abdomen' as GrupoMuscular, seriesDiretasPorSessao: 1, frequenciaSemanal: 1 }],
    ]
    for (const grupos of casos) {
      const r = ok(calcularVolume({ grupos }))
      const aviso = r.avisos.find((a) => a.codigo === 'FATOR_INDIRETO_E_CONVENCAO')
      expect(aviso).toBeTruthy()
      expect(aviso!.mensagem).toContain('convenção')
      expect(aviso!.contexto).toMatchObject({ fator: 0.5 })
    }
  })

  it('a proveniência registra o limite da meta-análise', () => {
    expect(PROVENIENCIA_VOLUME.observacao).toContain('não preditor individual')
    expect(PROVENIENCIA_VOLUME.fonteVerificadaEm).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('guardas', () => {
  it('rejeita frequência e séries inválidas', () => {
    expect(calcularVolume({ grupos: [{ grupo: 'peito', seriesDiretasPorSessao: 4, frequenciaSemanal: 0 }] }).ok).toBe(false)
    expect(calcularVolume({ grupos: [{ grupo: 'peito', seriesDiretasPorSessao: -1, frequenciaSemanal: 2 }] }).ok).toBe(false)
    expect(calcularVolume({ grupos: [{ grupo: 'peito', seriesDiretasPorSessao: 4, seriesIndiretasPorSessao: -2, frequenciaSemanal: 2 }] }).ok).toBe(false)
  })

  it('rejeita lista vazia e fator fora de 0 a 1', () => {
    expect(calcularVolume({ grupos: [] }).ok).toBe(false)
    expect(calcularVolume({ grupos: [{ grupo: 'peito', seriesDiretasPorSessao: 4, frequenciaSemanal: 2 }], fatorSerieIndireta: 1.5 }).ok).toBe(false)
  })

  it('todo grupo tem rótulo em português', () => {
    for (const [, label] of Object.entries(GRUPO_LABELS)) expect(label.length).toBeGreaterThan(2)
  })
})
