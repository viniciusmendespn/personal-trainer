import { describe, it, expect } from 'vitest'
import {
  calcularDobras,
  densidadeParaGordura,
  classificarGordura,
  sitiosDoProtocolo,
  CLASSIFICACAO,
  PROTOCOLOS,
  PROVENIENCIAS_DOBRAS,
  SITIO_COMO_MEDIR,
  SITIO_LABELS,
} from './dobras'
import type { Sexo } from './tipos'

function ok(r: ReturnType<typeof calcularDobras>) {
  if (!r.ok) throw new Error(`esperava ok, veio: ${r.avisos.map((a) => a.codigo).join(', ')}`)
  return r
}

describe('conversão densidade → gordura', () => {
  it('Siri e Brozek nos pontos conhecidos', () => {
    expect(densidadeParaGordura(1.1, 'siri')).toBeCloseTo(0, 4)
    expect(densidadeParaGordura(1.0, 'siri')).toBeCloseTo(45, 4)
    expect(densidadeParaGordura(1.103332, 'brozek')).toBeCloseTo(0, 3)
  })

  it('em densidade 1,11 o Siri já é negativo — justifica o guarda', () => {
    expect(densidadeParaGordura(1.11, 'siri')).toBeLessThan(0)
  })
})

describe('protocolos — valores conferidos à mão', () => {
  it('Jackson & Pollock 3, homem 30 anos, Σ = 48 mm', () => {
    const r = ok(calcularDobras({
      protocolo: 'jp3', sexo: 'M', idadeAnos: 30,
      dobrasMm: { peitoral: 12, abdominal: 20, coxa: 16 },
    }))
    expect(r.resultado.somaMm).toBe(48)
    expect(r.resultado.densidade).toBeCloseTo(1.065663, 5)
    expect(r.resultado.percentualGordura).toBeCloseTo(14.4997, 2)
  })

  it('Jackson & Pollock 3, mulher 25 anos, Σ = 57 mm', () => {
    const r = ok(calcularDobras({
      protocolo: 'jp3', sexo: 'F', idadeAnos: 25,
      dobrasMm: { triceps: 18, suprailiaca: 14, coxa: 25 },
    }))
    expect(r.resultado.densidade).toBeCloseTo(1.04689, 5)
    expect(r.resultado.percentualGordura).toBeCloseTo(22.8293, 2)
  })

  it('Jackson & Pollock 7, homem 35 anos, Σ = 95 mm', () => {
    const r = ok(calcularDobras({
      protocolo: 'jp7', sexo: 'M', idadeAnos: 35,
      dobrasMm: { peitoral: 10, axilarMedia: 12, triceps: 9, subescapular: 14, abdominal: 20, suprailiaca: 15, coxa: 15 },
    }))
    expect(r.resultado.somaMm).toBe(95)
    expect(r.resultado.densidade).toBeCloseTo(1.065551, 5)
    expect(r.resultado.percentualGordura).toBeCloseTo(14.5486, 2)
  })

  it('Yuhasz (Faulkner) entrega %G direto, sem densidade', () => {
    const r = ok(calcularDobras({
      protocolo: 'yuhasz', sexo: 'M', idadeAnos: 28,
      dobrasMm: { triceps: 12, subescapular: 14, suprailiaca: 15, abdominal: 20 },
    }))
    expect(r.resultado.somaMm).toBe(61)
    expect(r.resultado.densidade).toBeNull()
    expect(r.resultado.equacao).toBeNull()
    expect(r.resultado.percentualGordura).toBeCloseTo(15.116, 3)
  })

  it('Yuhasz com Σ = 40 mm dá 11,90%', () => {
    const r = ok(calcularDobras({
      protocolo: 'yuhasz', sexo: 'M', idadeAnos: 25,
      dobrasMm: { triceps: 10, subescapular: 10, suprailiaca: 10, abdominal: 10 },
    }))
    expect(r.resultado.percentualGordura).toBeCloseTo(11.903, 3)
  })

  it('Guedes homem, Σ = 45 mm (logarítmica, sem idade)', () => {
    const r = ok(calcularDobras({
      protocolo: 'guedes', sexo: 'M', idadeAnos: 22,
      dobrasMm: { triceps: 10, suprailiaca: 15, abdominal: 20 },
    }))
    expect(r.resultado.densidade).toBeCloseTo(1.060469, 5)
    expect(r.resultado.percentualGordura).toBeCloseTo(16.7744, 2)
  })

  it('Guedes mulher, Σ = 52 mm', () => {
    const r = ok(calcularDobras({
      protocolo: 'guedes', sexo: 'F', idadeAnos: 24,
      dobrasMm: { coxa: 25, suprailiaca: 14, subescapular: 13 },
    }))
    expect(r.resultado.densidade).toBeCloseTo(1.04535, 5)
    expect(r.resultado.percentualGordura).toBeCloseTo(23.5255, 2)
  })

  it('Petroski homem 40 anos, Σ = 52 mm', () => {
    const r = ok(calcularDobras({
      protocolo: 'petroski', sexo: 'M', idadeAnos: 40,
      dobrasMm: { subescapular: 14, triceps: 10, suprailiaca: 16, panturrilhaMedial: 12 },
    }))
    expect(r.resultado.densidade).toBeCloseTo(1.054072, 5)
    expect(r.resultado.percentualGordura).toBeCloseTo(19.6073, 2)
  })

  it('Petroski mulher 30 anos, Σ = 66 mm — a forma logarítmica correta', () => {
    const r = ok(calcularDobras({
      protocolo: 'petroski', sexo: 'F', idadeAnos: 30,
      dobrasMm: { axilarMedia: 12, suprailiaca: 15, coxa: 25, panturrilhaMedial: 14 },
    }))
    expect(r.resultado.somaMm).toBe(66)
    expect(r.resultado.densidade).toBeCloseTo(1.046438, 5)
    expect(r.resultado.percentualGordura).toBeCloseTo(23.0332, 2)
  })
})

describe('regressão: a forma errada do Petroski feminino', () => {
  it('a versão polinomial que circula em calculadoras BR devolve densidade negativa', () => {
    const soma = 66
    const idade = 30
    const errada = 1.0346585 - 0.00063129 * soma * soma - 0.000311 * idade
    expect(errada).toBeLessThan(0)
    // e a nossa implementação devolve o valor correto
    const r = ok(calcularDobras({
      protocolo: 'petroski', sexo: 'F', idadeAnos: idade,
      dobrasMm: { axilarMedia: 12, suprailiaca: 15, coxa: 25, panturrilhaMedial: 14 },
    }))
    expect(r.resultado.densidade).toBeGreaterThan(1)
  })

  it('o guarda de densidade transforma equação mal transcrita em erro visível', () => {
    // densidade negativa jamais poderia virar um %G plausível
    expect(densidadeParaGordura(-3.78, 'siri')).toBeLessThan(-450)
  })
})

describe('guardas', () => {
  it('avisa abaixo da gordura essencial', () => {
    const r = ok(calcularDobras({
      protocolo: 'jp3', sexo: 'M', idadeAnos: 20,
      dobrasMm: { peitoral: 3, abdominal: 4, coxa: 5 },
    }))
    expect(r.resultado.percentualGordura).toBeLessThan(3)
    expect(r.avisos.map((a) => a.codigo)).toContain('ABAIXO_DA_GORDURA_ESSENCIAL')
  })

  it('avisa idade fora da validade mas continua calculando', () => {
    const r = calcularDobras({
      protocolo: 'jp3', sexo: 'M', idadeAnos: 65,
      dobrasMm: { peitoral: 12, abdominal: 20, coxa: 16 },
    })
    expect(r.ok).toBe(true)
    const aviso = r.avisos.find((a) => a.codigo === 'IDADE_FORA_DA_VALIDADE')
    expect(aviso?.contexto).toMatchObject({ idade: 65, min: 18, max: 61 })
  })

  it('Guedes com 35 anos sai da faixa 17–27', () => {
    const r = calcularDobras({
      protocolo: 'guedes', sexo: 'M', idadeAnos: 35,
      dobrasMm: { triceps: 10, suprailiaca: 15, abdominal: 20 },
    })
    expect(r.avisos.map((a) => a.codigo)).toContain('IDADE_FORA_DA_VALIDADE')
  })

  it('avisa dobra implausível por sítio', () => {
    const r = ok(calcularDobras({
      protocolo: 'jp3', sexo: 'M', idadeAnos: 30,
      dobrasMm: { peitoral: 12, abdominal: 75, coxa: 16 },
    }))
    const aviso = r.avisos.find((a) => a.codigo === 'DOBRA_IMPLAUSIVEL')
    expect(aviso?.campo).toBe('dobrasMm.abdominal')
  })

  it('somatório alto legítimo continua válido', () => {
    const r = ok(calcularDobras({
      protocolo: 'jp3', sexo: 'F', idadeAnos: 50,
      dobrasMm: { triceps: 40, suprailiaca: 45, coxa: 50 },
    }))
    expect(r.resultado.percentualGordura).toBeGreaterThan(40)
    expect(r.resultado.classificacao?.rotulo).toBe('acima do recomendado')
  })

  it('sítio faltando é erro, não zero silencioso', () => {
    const r = calcularDobras({
      protocolo: 'jp7', sexo: 'M', idadeAnos: 30,
      dobrasMm: { peitoral: 10, axilarMedia: 12, triceps: 9, subescapular: 14, abdominal: 20, suprailiaca: 15 },
    })
    expect(r.ok).toBe(false)
    expect(r.avisos[0].codigo).toBe('CAMPO_OBRIGATORIO')
    expect(r.avisos[0].campo).toBe('dobrasMm.coxa')
  })

  it('idade fora do domínio é erro', () => {
    for (const idade of [0, 5, 120, NaN]) {
      const r = calcularDobras({ protocolo: 'jp3', sexo: 'M', idadeAnos: idade, dobrasMm: { peitoral: 12, abdominal: 20, coxa: 16 } })
      expect(r.ok).toBe(false)
    }
  })
})

describe('composição corporal', () => {
  it('massa gorda e magra somam o peso', () => {
    const r = ok(calcularDobras({
      protocolo: 'jp3', sexo: 'M', idadeAnos: 30, pesoKg: 80,
      dobrasMm: { peitoral: 12, abdominal: 20, coxa: 16 },
    }))
    expect(r.resultado.massaGordaKg).toBeCloseTo(11.5998, 2)
    expect(r.resultado.massaMagraKg).toBeCloseTo(68.4002, 2)
    expect(r.resultado.massaGordaKg! + r.resultado.massaMagraKg!).toBeCloseTo(80, 6)
  })

  it('sem peso, não inventa composição', () => {
    const r = ok(calcularDobras({ protocolo: 'jp3', sexo: 'M', idadeAnos: 30, dobrasMm: { peitoral: 12, abdominal: 20, coxa: 16 } }))
    expect(r.resultado.massaGordaKg).toBeNull()
    expect(r.resultado.massaMagraKg).toBeNull()
  })
})

describe('tabela de classificação — invariantes, não valores decorados', () => {
  for (const sexo of ['M', 'F'] as Sexo[]) {
    it(`faixas de ${sexo} são contíguas e cobrem 0 a 100`, () => {
      const faixas = CLASSIFICACAO[sexo]
      expect(faixas[0].min).toBe(0)
      expect(faixas[faixas.length - 1].max).toBe(100)
      for (let i = 0; i < faixas.length - 1; i++) {
        expect(faixas[i].max).toBe(faixas[i + 1].min)
      }
    })

    it(`classificar ${sexo} nunca devolve null dentro de 0 a 100`, () => {
      for (let p = 0; p < 100; p += 0.5) {
        expect(classificarGordura(sexo, p)).not.toBeNull()
      }
    })
  }
})

describe('integridade dos protocolos', () => {
  it('cada protocolo tem a quantidade certa de sítios', () => {
    const esperado: Record<string, number> = { jp3: 3, jp7: 7, yuhasz: 4, guedes: 3, petroski: 4 }
    for (const p of PROTOCOLOS) {
      for (const sexo of ['M', 'F'] as Sexo[]) {
        expect(sitiosDoProtocolo(p.id, sexo)).toHaveLength(esperado[p.id])
      }
    }
  })

  it('Pollock 3 em homens é peitoral, abdominal e coxa — não tríceps', () => {
    expect(sitiosDoProtocolo('jp3', 'M')).toEqual(['peitoral', 'abdominal', 'coxa'])
    expect(sitiosDoProtocolo('jp3', 'M')).not.toContain('triceps')
  })

  it('Pollock 7 usa axilar média e não panturrilha', () => {
    const sitios = sitiosDoProtocolo('jp7', 'M')
    expect(sitios).toContain('axilarMedia')
    expect(sitios).not.toContain('panturrilhaMedial')
  })

  it('todo provenienciaId referenciado existe', () => {
    for (const p of PROTOCOLOS) {
      for (const sexo of ['M', 'F'] as Sexo[]) {
        expect(PROVENIENCIAS_DOBRAS[p.provenienciaId[sexo]]).toBeTruthy()
      }
    }
  })

  it('toda proveniência tem fonteVerificadaEm no formato AAAA-MM', () => {
    for (const prov of Object.values(PROVENIENCIAS_DOBRAS)) {
      expect(prov.fonteVerificadaEm).toMatch(/^\d{4}-\d{2}$/)
      expect(prov.populacao.length).toBeGreaterThan(0)
    }
  })

  it('todo sítio tem rótulo e instrução de medida', () => {
    for (const p of PROTOCOLOS) {
      for (const sexo of ['M', 'F'] as Sexo[]) {
        for (const s of p.sitios[sexo]) {
          expect(SITIO_LABELS[s]).toBeTruthy()
          expect(SITIO_COMO_MEDIR[s].length).toBeGreaterThan(20)
        }
      }
    }
  })
})
