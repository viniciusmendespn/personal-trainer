import { describe, it, expect } from 'vitest'
import {
  parseDecimalPtBr,
  arredondar,
  arredondarCarga,
  arredondarComercial,
  distribuirPorMaiorResto,
} from './numero'

describe('parseDecimalPtBr', () => {
  it('aceita vírgula e ponto como decimal', () => {
    expect(parseDecimalPtBr('12,5', 'x').valor).toBe(12.5)
    expect(parseDecimalPtBr('12.5', 'x').valor).toBe(12.5)
    expect(parseDecimalPtBr('80', 'x').valor).toBe(80)
  })

  it('entende milhar com ponto e com vírgula decimal', () => {
    expect(parseDecimalPtBr('1.234,56', 'x').valor).toBe(1234.56)
    expect(parseDecimalPtBr('R$ 1.234,56', 'x').valor).toBe(1234.56)
    expect(parseDecimalPtBr('1,234.56', 'x').valor).toBe(1234.56)
  })

  it('remove sufixos de unidade', () => {
    expect(parseDecimalPtBr('80 kg', 'x').valor).toBe(80)
    expect(parseDecimalPtBr('12,5 mm', 'x').valor).toBe(12.5)
    expect(parseDecimalPtBr('25%', 'x').valor).toBe(25)
  })

  it('avisa quando o ponto é ambíguo e assume milhar', () => {
    const r = parseDecimalPtBr('1.500', 'x')
    expect(r.valor).toBe(1500)
    expect(r.avisos[0].codigo).toBe('SEPARADOR_AMBIGUO')
  })

  it('campo vazio devolve null, jamais 0 — Number("") daria 0', () => {
    for (const entrada of ['', ' ', null, undefined]) {
      const r = parseDecimalPtBr(entrada, 'x')
      expect(r.valor).toBeNull()
      expect(r.avisos[0].codigo).toBe('CAMPO_OBRIGATORIO')
    }
  })

  it('não trunca em silêncio como parseFloat faz', () => {
    // parseFloat('12,5') devolve 12 — o bug que este módulo existe para evitar
    expect(parseFloat('12,5')).toBe(12)
    expect(parseDecimalPtBr('12,5', 'x').valor).toBe(12.5)
  })

  it('rejeita entrada não numérica', () => {
    for (const entrada of ['abc', '12,5,5', '1.234.56', '--3']) {
      const r = parseDecimalPtBr(entrada, 'x')
      expect(r.valor).toBeNull()
      expect(r.avisos[0].codigo).toBe('VALOR_NAO_NUMERICO')
    }
  })

  it('aceita negativo — o domínio é responsabilidade de quem chama', () => {
    expect(parseDecimalPtBr('-5', 'x').valor).toBe(-5)
  })

  it('aceita number direto e rejeita NaN/Infinity', () => {
    expect(parseDecimalPtBr(42.5, 'x').valor).toBe(42.5)
    expect(parseDecimalPtBr(NaN, 'x').valor).toBeNull()
    expect(parseDecimalPtBr(Infinity, 'x').valor).toBeNull()
  })
})

describe('arredondar', () => {
  it('acerta os casos em que toFixed erra', () => {
    expect((2.675).toFixed(2)).toBe('2.67') // documenta o bug nativo
    expect(arredondar(2.675, 2)).toBe(2.68)
    expect(arredondar(1.005, 2)).toBe(1.01)
  })

  it('acerta o caso em que a variante com EPSILON erra', () => {
    expect(arredondar(8.165, 2)).toBe(8.17)
  })

  it('não estoura em valores extremos', () => {
    expect(arredondar(1e21, 2)).toBe(1e21)
    expect(Number.isNaN(arredondar(NaN, 2))).toBe(true)
    expect(Number.isNaN(arredondar(Infinity, 2))).toBe(true)
  })

  it('arredonda para inteiro e para muitas casas', () => {
    expect(arredondar(14.4997, 1)).toBe(14.5)
    expect(arredondar(1.0656628, 5)).toBe(1.06566)
    expect(arredondar(2759.4, 0)).toBe(2759)
  })
})

describe('arredondarCarga', () => {
  // 1RM 116,58 kg a 87% = 101,43 kg
  it('arredonda para baixo por padrão — errar carga para cima é lesão', () => {
    expect(arredondarCarga(101.4268)).toBe(100)
    expect(arredondarCarga(101.4268, 'kg2_5', 'proximo')).toBe(102.5)
    expect(arredondarCarga(101.4268, 'kg2_5', 'acima')).toBe(102.5)
  })

  it('respeita o incremento pedido', () => {
    expect(arredondarCarga(101.4268, 'kg1')).toBe(101)
    expect(arredondarCarga(101.4268, 'kg1', 'acima')).toBe(102)
  })

  it('converte para múltiplo de 5 lb e devolve em kg', () => {
    // o kg fica quebrado de propósito: o par de anilhas é que é redondo
    const kg = arredondarCarga(101.4268, 'lb5', 'abaixo')
    const lb = kg / 0.45359237
    expect(Math.round(lb) % 5).toBe(0)
    expect(kg).toBeLessThanOrEqual(101.4268)
  })

  it('já múltiplo exato não muda', () => {
    expect(arredondarCarga(100, 'kg2_5')).toBe(100)
    expect(arredondarCarga(102.5, 'kg2_5')).toBe(102.5)
  })
})

describe('arredondarComercial', () => {
  it('sobe para o próximo múltiplo', () => {
    expect(arredondarComercial(223.4043)).toBe(225)
    expect(arredondarComercial(223.4043, 10)).toBe(230)
    expect(arredondarComercial(225)).toBe(225)
  })
})

describe('distribuirPorMaiorResto', () => {
  it('a soma dos inteiros bate com o total', () => {
    const r = distribuirPorMaiorResto([160.4, 63.9, 385.75], 610)
    expect(r.reduce((a, b) => a + b, 0)).toBe(610)
  })

  it('mantém a soma exata em 500 combinações', () => {
    let semente = 12345
    const rnd = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648
      return semente / 2147483648
    }
    for (let i = 0; i < 500; i++) {
      const vals = [rnd() * 300, rnd() * 120, rnd() * 400]
      const total = Math.round(vals.reduce((a, b) => a + b, 0))
      expect(distribuirPorMaiorResto(vals, total).reduce((a, b) => a + b, 0)).toBe(total)
    }
  })

  it('não inventa valor quando os pisos já passam do total', () => {
    const r = distribuirPorMaiorResto([10.9, 10.9], 20)
    expect(r).toEqual([10, 10])
  })
})
