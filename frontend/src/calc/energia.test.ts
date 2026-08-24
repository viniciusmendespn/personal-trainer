import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { estimarEnergia, estimarTmb, FATORES_ATIVIDADE, RESSALVA_PROFISSIONAL, MINIMO_SEGURO_KCAL } from './energia'
import type { EntradaEnergia } from './energia'

function ok(r: ReturnType<typeof estimarEnergia>) {
  if (!r.ok) throw new Error(`esperava ok: ${r.avisos.map((a) => a.mensagem).join(' | ')}`)
  return r
}

describe('estimarTmb — valores conferidos à mão', () => {
  it('homem 80 kg, 180 cm, 30 anos', () => {
    expect(estimarTmb('M', 80, 180, 30, 'mifflin')).toBeCloseTo(1780, 4)
    expect(estimarTmb('M', 80, 180, 30, 'harrisBenedict')).toBeCloseTo(1853.632, 3)
    expect(estimarTmb('M', 80, 180, 30, 'katchMcArdle', 15)).toBeCloseTo(1838.8, 3)
  })

  it('mulher 60 kg, 165 cm, 40 anos', () => {
    expect(estimarTmb('F', 60, 165, 40, 'mifflin')).toBeCloseTo(1270.25, 4)
    expect(estimarTmb('F', 60, 165, 40, 'harrisBenedict')).toBeCloseTo(1340.383, 3)
  })

  it('Katch sem percentual de gordura devolve null', () => {
    expect(estimarTmb('M', 80, 180, 30, 'katchMcArdle')).toBeNull()
  })
})

describe('estimarEnergia — caso A', () => {
  const entrada: EntradaEnergia = {
    sexo: 'M', pesoKg: 80, alturaCm: 180, idadeAnos: 30,
    nivelAtividade: 'moderado', objetivo: 'manutencao',
    proteinaGPorKg: 2, gordura: { base: 'gPorKg', valor: 0.8 },
  }

  it('TMB, fator e gasto total', () => {
    const r = ok(estimarEnergia(entrada))
    expect(r.resultado.tmbKcal).toBeCloseTo(1780, 2)
    expect(r.resultado.fatorAtividade).toBe(1.55)
    expect(r.resultado.gastoEnergeticoTotalKcal).toBeCloseTo(2759, 2)
    expect(r.resultado.caloriasEstimadasKcal).toBeCloseTo(2759, 2)
  })

  it('macros: proteína 160 g, gordura 64 g, carboidrato 385,75 g', () => {
    const m = ok(estimarEnergia(entrada)).resultado.distribuicaoDeMacros
    expect(m.proteina.gramas).toBe(160)
    expect(m.gordura.gramas).toBe(64)
    expect(m.carboidrato.gramas).toBe(386) // 385,75 arredondado mantendo a soma
  })

  it('o comparativo traz as três equações', () => {
    const r = ok(estimarEnergia({ ...entrada, percentualGordura: 15 }))
    const porEq = Object.fromEntries(r.resultado.comparativoEquacoes.map((c) => [c.equacao, c.tmbKcal]))
    expect(porEq.mifflin).toBeCloseTo(1780, 2)
    expect(porEq.harrisBenedict).toBeCloseTo(1853.63, 1)
    expect(porEq.katchMcArdle).toBeCloseTo(1838.8, 1)
  })
})

describe('estimarEnergia — caso B', () => {
  const entrada: EntradaEnergia = {
    sexo: 'F', pesoKg: 60, alturaCm: 165, idadeAnos: 40,
    nivelAtividade: 'leve', objetivo: 'deficit', ajustePercentual: 0.2,
    proteinaGPorKg: 1.8, gordura: { base: 'percentualDasCalorias', valor: 0.25 },
  }

  it('gasto total e estimativa após o déficit', () => {
    // valores crus 1746,59375 e 1397,275; a saída é arredondada em 2 casas
    const r = ok(estimarEnergia(entrada))
    expect(r.resultado.gastoEnergeticoTotalKcal).toBe(1746.59)
    expect(r.resultado.caloriasEstimadasKcal).toBe(1397.28)
  })

  it('macros com gordura em percentual das calorias', () => {
    const m = ok(estimarEnergia(entrada)).resultado.distribuicaoDeMacros
    expect(m.proteina.gramas).toBe(108)
    expect(m.gordura.gramas).toBe(39) // 38,8132
    expect(m.carboidrato.gramas).toBe(154) // 153,9891
  })
})

describe('invariante dos macros', () => {
  it('a soma das kcal dos macros bate com a estimativa em ±4 kcal', () => {
    const casos: EntradaEnergia[] = [
      { sexo: 'M', pesoKg: 80, alturaCm: 180, idadeAnos: 30, nivelAtividade: 'moderado' },
      { sexo: 'F', pesoKg: 60, alturaCm: 165, idadeAnos: 40, nivelAtividade: 'leve', objetivo: 'deficit' },
      { sexo: 'M', pesoKg: 95, alturaCm: 190, idadeAnos: 22, nivelAtividade: 'intenso', objetivo: 'superavit' },
      { sexo: 'F', pesoKg: 72, alturaCm: 158, idadeAnos: 55, nivelAtividade: 'sedentario' },
    ]
    for (const c of casos) {
      const r = ok(estimarEnergia(c))
      const m = r.resultado.distribuicaoDeMacros
      const soma = m.proteina.gramas * 4 + m.gordura.gramas * 9 + m.carboidrato.gramas * 4
      expect(Math.abs(soma - r.resultado.caloriasEstimadasKcal)).toBeLessThanOrEqual(4)
    }
  })
})

describe('guardas', () => {
  it('avisa abaixo do mínimo seguro', () => {
    const r = ok(estimarEnergia({
      sexo: 'F', pesoKg: 50, alturaCm: 155, idadeAnos: 55,
      nivelAtividade: 'sedentario', objetivo: 'deficit', ajustePercentual: 0.3,
    }))
    expect(r.resultado.caloriasEstimadasKcal).toBeLessThan(MINIMO_SEGURO_KCAL.F)
    const aviso = r.avisos.find((a) => a.codigo === 'ABAIXO_DO_MINIMO_SEGURO')
    expect(aviso!.correcao).toContain('nutricionista')
  })

  it('carboidrato nunca fica negativo', () => {
    const r = ok(estimarEnergia({
      sexo: 'M', pesoKg: 60, alturaCm: 170, idadeAnos: 30,
      nivelAtividade: 'sedentario', objetivo: 'deficit', ajustePercentual: 0.5,
      proteinaGPorKg: 2.5, gordura: { base: 'gPorKg', valor: 1 },
    }))
    expect(r.resultado.distribuicaoDeMacros.carboidrato.gramas).toBeGreaterThanOrEqual(0)
    expect(r.avisos.map((a) => a.codigo)).toContain('MACROS_EXCEDEM_CALORIAS')
  })

  it('Katch sem percentual de gordura é erro explicado', () => {
    const r = estimarEnergia({ sexo: 'M', pesoKg: 80, alturaCm: 180, idadeAnos: 30, nivelAtividade: 'moderado', equacao: 'katchMcArdle' })
    expect(r.ok).toBe(false)
    expect(r.avisos[0].codigo).toBe('KATCH_EXIGE_PERCENTUAL_DE_GORDURA')
    expect(r.avisos[0].correcao).toContain('dobras-cutaneas')
  })

  it('avisa proteína e gordura fora do usual', () => {
    const alta = ok(estimarEnergia({ sexo: 'M', pesoKg: 80, alturaCm: 180, idadeAnos: 30, nivelAtividade: 'moderado', proteinaGPorKg: 3.5 }))
    expect(alta.avisos.map((a) => a.codigo)).toContain('PROTEINA_ACIMA_DO_USUAL')
    const baixa = ok(estimarEnergia({ sexo: 'M', pesoKg: 80, alturaCm: 180, idadeAnos: 30, nivelAtividade: 'moderado', gordura: { base: 'gPorKg', valor: 0.3 } }))
    expect(baixa.avisos.map((a) => a.codigo)).toContain('GORDURA_ABAIXO_DO_USUAL')
  })

  it('rejeita medidas fora do plausível', () => {
    const base = { sexo: 'M' as const, pesoKg: 80, alturaCm: 180, idadeAnos: 30, nivelAtividade: 'moderado' as const }
    expect(estimarEnergia({ ...base, idadeAnos: 0 }).ok).toBe(false)
    expect(estimarEnergia({ ...base, idadeAnos: 130 }).ok).toBe(false)
    expect(estimarEnergia({ ...base, alturaCm: 40 }).ok).toBe(false)
    expect(estimarEnergia({ ...base, pesoKg: 0 }).ok).toBe(false)
  })
})

describe('limite profissional (CFN 600/2018)', () => {
  it('toda chamada válida devolve a ressalva e o aviso', () => {
    const matriz: EntradaEnergia[] = []
    for (const sexo of ['M', 'F'] as const) {
      for (const nivel of FATORES_ATIVIDADE) {
        matriz.push({ sexo, pesoKg: 70, alturaCm: 170, idadeAnos: 30, nivelAtividade: nivel.id })
      }
    }
    for (const c of matriz) {
      const r = ok(estimarEnergia(c))
      expect(r.resultado.ressalvaProfissional).toBe(RESSALVA_PROFISSIONAL)
      expect(r.avisos.map((a) => a.codigo)).toContain('ESTIMATIVA_EDUCATIVA_NAO_PRESCRICAO')
      expect(r.resultado.provenienciaIds).toContain('cfn-600-2018')
    }
  })

  it('a ressalva cita a resolução', () => {
    expect(RESSALVA_PROFISSIONAL).toContain('600/2018')
    expect(RESSALVA_PROFISSIONAL).toContain('nutricionista')
  })
})

// Lint semântico: barato, e evita que alguém escreva "kcal recomendadas" daqui a
// seis meses sem perceber que isso muda a natureza jurídica da página.
describe('lint semântico do módulo calc/', () => {
  const dir = join(import.meta.dirname, '.')
  const fontes = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  // Só o código interessa: os comentários citam parseFloat justamente para explicar
  // por que ele não é usado.
  const codigo = (f: string) =>
    readFileSync(join(dir, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('nenhum arquivo chama parseFloat', () => {
    for (const f of fontes) {
      expect(codigo(f), f).not.toMatch(/\bparseFloat\(/)
    }
  })

  it('só numero.ts chama toFixed', () => {
    for (const f of fontes.filter((x) => x !== 'numero.ts')) {
      expect(codigo(f), f).not.toMatch(/\.toFixed\(/)
    }
  })

  it('nenhum arquivo chama new Date — quebraria os testes na virada do ano', () => {
    for (const f of fontes) {
      expect(codigo(f), f).not.toMatch(/new Date\(/)
    }
  })

  it('nenhum literal fiscal fora de precificacao.ts (onde vive datado)', () => {
    for (const f of fontes.filter((x) => x !== 'precificacao.ts')) {
      expect(codigo(f), f).not.toMatch(/86\.05|81000/)
    }
  })

  it('energia.ts não usa vocabulário de prescrição', () => {
    const src = readFileSync(join(dir, 'energia.ts'), 'utf8')
    // "prescrição" aparece só no comentário e na ressalva, sempre negando
    for (const termo of [/\bprescrever\b/i, /\bplano alimentar\b/i, /\bcardapio\b/i, /\bcardápio\b/i]) {
      const ocorrencias = src.match(new RegExp(termo.source, 'gi')) ?? []
      const permitidas = ocorrencias.filter((o) => src.includes(`não ${o}`) || src.includes('privativa'))
      expect(ocorrencias.length, `${termo} aparece fora de contexto de negação`).toBe(permitidas.length)
    }
  })
})
