import { describe, it, expect } from 'vitest'
import { precificar, PRESETS_IMPOSTO, REFERENCIAS_MERCADO } from './precificacao'

function ok(r: ReturnType<typeof precificar>) {
  if (!r.ok) throw new Error(`esperava ok: ${r.avisos.map((a) => a.mensagem).join(' | ')}`)
  return r
}

describe('precificar — caso A, conferido à mão', () => {
  const entrada = {
    custoFixoMensal: 2500,
    horasDisponiveisSemana: 30,
    taxaOcupacao: 0.7,
    aliquotaImposto: 0.06,
    rendaLiquidaDesejada: 6000,
    tetoFaturamentoAnual: 81000,
  }

  it('capacidade e preços', () => {
    const r = ok(precificar(entrada))
    expect(r.resultado.capacidade.horasMes).toBeCloseTo(129.9, 4)
    expect(r.resultado.capacidade.sessoesMesRealista).toBeCloseTo(90.93, 4)
    expect(r.resultado.faturamentoBrutoBreakEven).toBeCloseTo(2659.5745, 3)
    expect(r.resultado.precoMinimoSessao).toBeCloseTo(29.2486, 3)
    expect(r.resultado.faturamentoBrutoMeta).toBeCloseTo(9042.5532, 3)
    expect(r.resultado.precoMetaSessao).toBeCloseTo(99.4452, 3)
  })

  it('mensalidades equivalentes', () => {
    const r = ok(precificar(entrada))
    const porFreq = Object.fromEntries(r.resultado.mensalidades.map((m) => [m.vezesPorSemana, m.valorMensal]))
    expect(porFreq[1]).toBeCloseTo(430.5978, 2)
    expect(porFreq[2]).toBeCloseTo(861.1955, 2)
    expect(porFreq[3]).toBeCloseTo(1291.7933, 2)
  })

  it('alunos necessários e o alerta de capacidade', () => {
    const r = ok(precificar(entrada))
    const doisPorSemana = r.resultado.alunosParaMeta.find((a) => a.vezesPorSemana === 2)!
    expect(doisPorSemana.alunos).toBe(11)
    expect(doisPorSemana.sessoesExigidas).toBeCloseTo(95.26, 2)
    const aviso = r.avisos.find((a) => a.codigo === 'META_ACIMA_DA_CAPACIDADE')
    expect(aviso).toBeTruthy()
    expect(aviso!.contexto!.capacidade).toBeCloseTo(90.93, 2)
  })

  it('avisa quando estoura o teto do MEI', () => {
    const r = ok(precificar(entrada))
    expect(r.resultado.faturamentoAnualProjetado).toBeCloseTo(108510.64, 1)
    const aviso = r.avisos.find((a) => a.codigo === 'TETO_MEI_ESTOURADO')
    expect(aviso!.contexto).toMatchObject({ teto: 81000 })
  })
})

describe('precificar — caso B, números redondos', () => {
  const entrada = {
    custoFixoMensal: 1200,
    horasDisponiveisSemana: 10,
    taxaOcupacao: 0.5,
    aliquotaImposto: 0.06,
    rendaLiquidaDesejada: 3000,
    semanasPorMes: 4,
  }

  it('confere de cabeça', () => {
    const r = ok(precificar(entrada))
    expect(r.resultado.capacidade.sessoesMesRealista).toBe(20)
    expect(r.resultado.precoMinimoSessao).toBeCloseTo(63.8298, 3)
    expect(r.resultado.precoMetaSessao).toBeCloseTo(223.4043, 3)
    expect(r.resultado.precoMetaSessaoComercial).toBe(225)
    const duas = r.resultado.mensalidades.find((m) => m.vezesPorSemana === 2)!
    expect(duas.valorMensal).toBeCloseTo(1787.234, 2)
  })
})

describe('precificar — guardas', () => {
  const base = {
    custoFixoMensal: 1000,
    horasDisponiveisSemana: 20,
    taxaOcupacao: 0.6,
    aliquotaImposto: 0.06,
    rendaLiquidaDesejada: 4000,
  }

  it('rejeita ocupação inválida', () => {
    for (const taxaOcupacao of [0, -0.1, 1.5, NaN]) {
      expect(precificar({ ...base, taxaOcupacao }).ok).toBe(false)
    }
  })

  it('rejeita alíquota de 100% — dividiria por zero', () => {
    expect(precificar({ ...base, aliquotaImposto: 1 }).ok).toBe(false)
    expect(precificar({ ...base, aliquotaImposto: 1.2 }).ok).toBe(false)
  })

  it('rejeita zero hora disponível', () => {
    expect(precificar({ ...base, horasDisponiveisSemana: 0 }).ok).toBe(false)
  })

  it('avisa ocupação irreal mas calcula', () => {
    const r = ok(precificar({ ...base, taxaOcupacao: 0.95 }))
    expect(r.avisos.map((a) => a.codigo)).toContain('OCUPACAO_IRREAL')
  })

  it('preço fora da faixa de mercado é informação, não bloqueio', () => {
    const r = ok(precificar({ ...base, custoFixoMensal: 200, rendaLiquidaDesejada: 500 }))
    expect(r.ok).toBe(true)
    const aviso = r.avisos.find((a) => a.codigo === 'PRECO_FORA_DA_REFERENCIA_DE_MERCADO')
    expect(aviso?.nivel).toBe('info')
  })

  it('o DAS fixo do MEI entra como tributo, não como percentual', () => {
    const semDas = ok(precificar(base)).resultado.faturamentoBrutoMeta
    const comDas = ok(precificar({ ...base, tributoFixoMensal: 86.05 })).resultado.faturamentoBrutoMeta
    expect(comDas).toBeGreaterThan(semDas)
    expect(comDas - semDas).toBeCloseTo(86.05 / 0.94, 2)
  })
})

describe('dados fiscais e de mercado', () => {
  it('todo preset tem verificadoEm no formato AAAA-MM', () => {
    for (const p of PRESETS_IMPOSTO) expect(p.verificadoEm).toMatch(/^\d{4}-\d{2}$/)
  })

  it('toda referência de mercado tem verificadoEm e faixa coerente', () => {
    for (const r of REFERENCIAS_MERCADO) {
      expect(r.verificadoEm).toMatch(/^\d{4}-\d{2}$/)
      expect(r.max).toBeGreaterThan(r.min)
    }
  })

  it('o preset do MEI carrega DAS e teto', () => {
    const mei = PRESETS_IMPOSTO.find((p) => p.id === 'mei')!
    expect(mei.valorFixoMensal).toBe(86.05)
    expect(mei.tetoFaturamentoAnual).toBe(81000)
    expect(mei.aliquota).toBe(0)
  })
})
