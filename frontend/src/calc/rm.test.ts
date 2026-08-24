import { describe, it, expect } from 'vitest'
import { estimar1Rm, tabelaDeCargas, cargaParaPercentual, TABELA_NSCA, FORMULAS_RM } from './rm'
import { PAGES } from '../pages/landing/publicSeoData.js'

function porFormula(cargaKg: number, reps: number) {
  const r = estimar1Rm({ cargaKg, reps })
  if (!r.ok) throw new Error('esperava ok')
  return Object.fromEntries(r.resultado.estimativas.map((e) => [e.formula, e.umRmKg]))
}

describe('estimar1Rm — valores conferidos à mão', () => {
  it('100 kg × 5 repetições', () => {
    const v = porFormula(100, 5)
    expect(v.epley).toBeCloseTo(116.6667, 3)
    expect(v.brzycki).toBeCloseTo(112.5, 3)
    expect(v.lombardi).toBeCloseTo(117.4619, 3)
    expect(v.oconner).toBeCloseTo(112.5, 3)
    expect(v.lander).toBeCloseTo(113.7089, 3)
    expect(v.mayhew).toBeCloseTo(119.0107, 3)
    expect(v.wathen).toBeCloseTo(116.5825, 3)

    const r = estimar1Rm({ cargaKg: 100, reps: 5 })
    if (!r.ok) throw new Error('esperava ok')
    expect(r.resultado.medianaKg).toBeCloseTo(116.5825, 3)
    expect(r.resultado.faixa.minKg).toBeCloseTo(112.5, 3)
    expect(r.resultado.faixa.maxKg).toBeCloseTo(119.0107, 3)
    expect(r.resultado.confianca).toBe('alta')
  })

  it('100 kg × 8 repetições — a mediana converge com a tabela NSCA', () => {
    const v = porFormula(100, 8)
    expect(v.epley).toBeCloseTo(126.6667, 3)
    expect(v.brzycki).toBeCloseTo(124.1379, 3)
    expect(v.lombardi).toBeCloseTo(123.1144, 3)
    expect(v.oconner).toBeCloseTo(120, 3)
    expect(v.lander).toBeCloseTo(125.1094, 3)
    expect(v.mayhew).toBeCloseTo(126.2864, 3)
    expect(v.wathen).toBeCloseTo(127.6714, 3)

    const r = estimar1Rm({ cargaKg: 100, reps: 8 })
    if (!r.ok) throw new Error('esperava ok')
    // NSCA: 8 reps = 80% → 100 / 0,80 = 125,0. Duas fontes independentes a 100 g de distância.
    expect(r.resultado.medianaKg).toBeCloseTo(125.1094, 3)
    expect(Math.abs(r.resultado.medianaKg - 125)).toBeLessThan(0.2)
  })

  it('80 kg × 8 repetições', () => {
    const v = porFormula(80, 8)
    expect(v.epley).toBeCloseTo(101.3333, 3)
    expect(v.brzycki).toBeCloseTo(99.3103, 3)
    expect(v.lombardi).toBeCloseTo(98.4916, 3)
    expect(v.oconner).toBeCloseTo(96, 3)
    expect(v.lander).toBeCloseTo(100.0875, 3)
    expect(v.mayhew).toBeCloseTo(101.0291, 3)
    expect(v.wathen).toBeCloseTo(102.1371, 3)
  })
})

describe('estimar1Rm — casos-limite e guardas', () => {
  it('com 1 repetição as sete devolvem a própria carga', () => {
    const v = porFormula(120, 1)
    for (const f of FORMULAS_RM) expect(v[f.id]).toBe(120)
  })

  it('sem o curto-circuito, Mayhew erraria em 1 repetição', () => {
    // prova de que o curto-circuito é necessário, não decorativo
    const mayhewCru = (100 * 120) / (52.2 + 41.9 * Math.exp(-0.055 * 1))
    expect(mayhewCru).toBeGreaterThan(130)
    expect(porFormula(120, 1).mayhew).toBe(120)
  })

  it('12 repetições calcula, mas com confiança baixa', () => {
    const r = estimar1Rm({ cargaKg: 100, reps: 12 })
    if (!r.ok) throw new Error('esperava ok')
    expect(r.resultado.confianca).toBe('baixa')
    expect(r.resultado.erroTipicoPct).toBe(18)
    expect(r.avisos.map((a) => a.codigo)).toContain('REPS_ALTAS_BAIXA_CONFIANCA')
  })

  it('rejeita entradas fora do domínio sem lançar', () => {
    for (const reps of [0, 13, 15, 2.5, NaN]) {
      const r = estimar1Rm({ cargaKg: 100, reps })
      expect(r.ok).toBe(false)
      expect(r.avisos[0].codigo).toBe('FORA_DO_DOMINIO')
      expect(r.avisos[0].campo).toBe('reps')
    }
    for (const carga of [0, -10, NaN, 5000]) {
      const r = estimar1Rm({ cargaKg: carga, reps: 5 })
      expect(r.ok).toBe(false)
      expect(r.avisos[0].campo).toBe('cargaKg')
    }
  })

  it('nunca produz Infinity — 37 reps zeraria o denominador de Brzycki', () => {
    const r = estimar1Rm({ cargaKg: 100, reps: 37 })
    expect(r.ok).toBe(false)
  })
})

describe('estimar1Rm — invariantes', () => {
  it('cada fórmula cresce com a carga e com as repetições', () => {
    for (const f of FORMULAS_RM) {
      for (let r = 1; r <= 12; r++) {
        expect(porFormula(200, r)[f.id]).toBeGreaterThan(porFormula(100, r)[f.id])
      }
      for (let r = 2; r <= 12; r++) {
        expect(porFormula(100, r)[f.id]).toBeGreaterThan(porFormula(100, r - 1)[f.id])
      }
    }
  })

  it('a amplitude entre as sete fica abaixo de 12% da mediana', () => {
    for (let reps = 2; reps <= 12; reps++) {
      const r = estimar1Rm({ cargaKg: 100, reps })
      if (!r.ok) throw new Error('esperava ok')
      expect(r.resultado.faixa.amplitudePct).toBeLessThan(12)
    }
  })

  it('Epley e Brzycki cruzam exatamente em 10 repetições', () => {
    const em10 = porFormula(100, 10)
    expect(em10.epley).toBeCloseTo(em10.brzycki, 6)
    expect(em10.epley).toBeCloseTo(133.3333, 3)
    // abaixo de 10 Epley é maior; acima, Brzycki
    expect(porFormula(100, 5).epley).toBeGreaterThan(porFormula(100, 5).brzycki)
    expect(porFormula(100, 12).brzycki).toBeGreaterThan(porFormula(100, 12).epley)
  })

  it('ida e volta pela tabela NSCA fica dentro de ±2%', () => {
    for (const { reps } of TABELA_NSCA) {
      if (reps === 1) continue
      const est = estimar1Rm({ cargaKg: 100, reps })
      if (!est.ok) throw new Error('esperava ok')
      const t = tabelaDeCargas({ umRmKg: est.resultado.medianaKg })
      if (!t.ok) throw new Error('esperava ok')
      const linha = t.resultado.linhas.find((l) => l.reps === reps)!
      expect(Math.abs(linha.cargaKg - 100) / 100).toBeLessThanOrEqual(0.02)
    }
  })
})

describe('tabelaDeCargas', () => {
  it('omite 11 repetições por padrão', () => {
    const t = tabelaDeCargas({ umRmKg: 120 })
    if (!t.ok) throw new Error('esperava ok')
    expect(t.resultado.linhas.map((l) => l.reps)).not.toContain(11)
    expect(t.resultado.linhas).toHaveLength(11)
  })

  it('quando incluída, 11 repetições vem marcada como interpolada', () => {
    const t = tabelaDeCargas({ umRmKg: 120, incluirInterpolados: true })
    if (!t.ok) throw new Error('esperava ok')
    const linha = t.resultado.linhas.find((l) => l.reps === 11)!
    expect(linha.percentual).toBe(72.5)
    expect(linha.interpolado).toBe(true)
    expect(t.avisos.map((a) => a.codigo)).toContain('PERCENTUAL_INTERPOLADO')
  })

  it('converte porcentagem em carga corretamente', () => {
    const t = tabelaDeCargas({ umRmKg: 120 })
    if (!t.ok) throw new Error('esperava ok')
    const porReps = Object.fromEntries(t.resultado.linhas.map((l) => [l.reps, l.cargaKg]))
    expect(porReps[1]).toBeCloseTo(120, 2)
    expect(porReps[5]).toBeCloseTo(104.4, 2)
    expect(porReps[8]).toBeCloseTo(96, 2)
    expect(porReps[12]).toBeCloseTo(84, 2)
  })

  it('rejeita 1RM inválido', () => {
    expect(tabelaDeCargas({ umRmKg: 0 }).ok).toBe(false)
    expect(tabelaDeCargas({ umRmKg: NaN }).ok).toBe(false)
  })
})

describe('cargaParaPercentual', () => {
  it('arredonda para baixo por padrão', () => {
    expect(cargaParaPercentual(116.58, 87)).toBe(100)
    expect(cargaParaPercentual(116.58, 87, 'kg2_5', 'proximo')).toBe(102.5)
  })
})

// Sincronia entre a tabela usada no cálculo e a publicada como conteúdo indexável.
// Mesmo papel de backend/tests/test_mcp_prompt_sync.py: dado duplicado só é seguro
// com teste provando que as cópias não divergiram.
describe('tabela NSCA publicada x tabela usada no cálculo', () => {
  it('as duas cópias batem linha a linha', () => {
    const secao = PAGES['calculadora-1rm'].sections.find((s) => s.table && s.title.includes('porcentagem'))
    expect(secao?.table).toBeTruthy()
    const linhas = secao!.table!.rows
    expect(linhas).toHaveLength(TABELA_NSCA.length)
    linhas.forEach((linha, i) => {
      expect(Number(linha[0])).toBe(TABELA_NSCA[i].reps)
      expect(Number(linha[1].replace('%', ''))).toBe(TABELA_NSCA[i].percentual)
      // terceira coluna: carga para 1RM de 120 kg
      const esperado = (120 * TABELA_NSCA[i].percentual) / 100
      expect(Number(linha[2].replace(' kg', '').replace(',', '.'))).toBeCloseTo(esperado, 1)
    })
  })

  it('a página não publica 11 repetições', () => {
    const secao = PAGES['calculadora-1rm'].sections.find((s) => s.table && s.title.includes('porcentagem'))
    expect(secao!.table!.rows.map((r) => r[0])).not.toContain('11')
  })
})
