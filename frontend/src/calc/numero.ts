// Parse e arredondamento das calculadoras. A superfície de bug aqui é o campo de
// entrada, não a fórmula — por isso este arquivo existe e tem teste próprio.
import type { Aviso } from './tipos'

export interface ParseNumero {
  valor: number | null
  avisos: Aviso[]
}

const SUFIXOS = /(?:r\$|kg|cm|mm|kcal|%|\s| )/gi
/** 1.500 e 1.234.567 são milhar; 12.5 e 1.5000 não. */
const SO_MILHAR = /^\d{1,3}(\.\d{3})+$/

/**
 * Converte entrada pt-BR em número. Vazio devolve null, NUNCA 0.
 *
 * Os nativos não servem: `parseFloat('12,5')` devolve 12 — trunca em silêncio, então
 * o aluno digita 12,5 mm e a conta usa 12. E `Number('')` devolve 0, o que faz campo
 * em branco virar zero e produzir resultado errado sem nenhum sinal.
 */
export function parseDecimalPtBr(
  bruto: string | number | null | undefined,
  campo: string,
): ParseNumero {
  if (typeof bruto === 'number') {
    return Number.isFinite(bruto)
      ? { valor: bruto, avisos: [] }
      : { valor: null, avisos: [naoNumerico(campo)] }
  }
  if (bruto == null) return { valor: null, avisos: [obrigatorio(campo)] }

  const limpo = bruto.replace(SUFIXOS, '')
  if (limpo === '') return { valor: null, avisos: [obrigatorio(campo)] }

  const temVirgula = limpo.includes(',')
  const temPonto = limpo.includes('.')
  const avisos: Aviso[] = []
  let normalizado: string

  if (temVirgula && temPonto) {
    // O último separador é o decimal; o outro é milhar.
    const ultimaVirgula = limpo.lastIndexOf(',')
    const ultimoPonto = limpo.lastIndexOf('.')
    normalizado = ultimaVirgula > ultimoPonto
      ? limpo.replaceAll('.', '').replace(',', '.')
      : limpo.replaceAll(',', '')
  } else if (temVirgula) {
    normalizado = limpo.replace(',', '.')
  } else if (temPonto && SO_MILHAR.test(limpo)) {
    normalizado = limpo.replaceAll('.', '')
    avisos.push({
      codigo: 'SEPARADOR_AMBIGUO',
      nivel: 'info',
      campo,
      mensagem: `Entendi "${bruto.trim()}" como ${normalizado}.`,
      correcao: 'Se quis dizer outro valor, use vírgula para o decimal.',
    })
  } else {
    normalizado = limpo
  }

  if (!/^-?\d*\.?\d+$/.test(normalizado)) {
    return { valor: null, avisos: [naoNumerico(campo)] }
  }
  const valor = Number(normalizado)
  if (!Number.isFinite(valor)) return { valor: null, avisos: [naoNumerico(campo)] }
  return { valor, avisos }
}

function obrigatorio(campo: string): Aviso {
  return { codigo: 'CAMPO_OBRIGATORIO', nivel: 'erro', campo, mensagem: 'Preencha este campo.' }
}

function naoNumerico(campo: string): Aviso {
  return {
    codigo: 'VALOR_NAO_NUMERICO',
    nivel: 'erro',
    campo,
    mensagem: 'Use apenas números.',
    correcao: 'Exemplo: 82,5',
  }
}

/**
 * Arredonda meio-para-cima de forma confiável.
 *
 * `toFixed` erra por representação binária (2,675 → "2.67"; 1,005 → "1.00") e a
 * variante `Math.round((x + EPSILON) * 100) / 100` também falha em 8,165 → 8,16.
 * O deslocamento exponencial acerta os três. Todas as grandezas aqui são positivas,
 * então meio-para-cima e meio-para-longe-de-zero nunca divergem na prática.
 */
export function arredondar(x: number, casas: number): number {
  if (!Number.isFinite(x)) return NaN
  // Acima disso a notação exponencial quebra; nenhuma grandeza aqui chega perto.
  if (Math.abs(x) >= 1e15) return x
  const deslocado = Number(`${x}e${casas}`)
  if (!Number.isFinite(deslocado)) return Number(x.toFixed(Math.max(0, casas)))
  return Number(`${Math.round(deslocado)}e${-casas}`)
}

export type IncrementoCarga = 'kg2_5' | 'kg1' | 'lb5'
export type ModoArredondamento = 'proximo' | 'abaixo' | 'acima'

const KG_POR_LB = 0.45359237

/**
 * Arredonda carga para o que dá para montar na barra.
 *
 * Default 'abaixo' de propósito: em prescrição, errar a carga para baixo é
 * conservador; para cima é lesão.
 */
export function arredondarCarga(
  kg: number,
  incremento: IncrementoCarga = 'kg2_5',
  modo: ModoArredondamento = 'abaixo',
): number {
  if (!Number.isFinite(kg)) return NaN
  if (incremento === 'lb5') {
    const lb = kg / KG_POR_LB
    return arredondar(aplicar(lb, 5, modo) * KG_POR_LB, 3)
  }
  const passo = incremento === 'kg1' ? 1 : 2.5
  return arredondar(aplicar(kg, passo, modo), 3)
}

function aplicar(valor: number, passo: number, modo: ModoArredondamento): number {
  const n = valor / passo
  const arredondado = modo === 'abaixo' ? Math.floor(n) : modo === 'acima' ? Math.ceil(n) : Math.round(n)
  return arredondado * passo
}

/** Preço "de tabela": múltiplo de 5 ou 10 reais, sempre para cima. */
export function arredondarComercial(reais: number, multiplo: 5 | 10 = 5): number {
  if (!Number.isFinite(reais)) return NaN
  return Math.ceil(reais / multiplo) * multiplo
}

/**
 * Arredonda para inteiro sem que a soma deixe de bater com o total.
 *
 * Necessário nos macros: arredondar proteína, gordura e carboidrato de forma
 * independente faz a soma das calorias fugir do total exibido logo acima.
 */
export function distribuirPorMaiorResto(valores: number[], total: number): number[] {
  const pisos = valores.map((v) => Math.floor(v))
  const faltam = Math.round(total) - pisos.reduce((a, b) => a + b, 0)
  if (faltam <= 0) return pisos
  const ordem = valores
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i)
  for (let k = 0; k < faltam; k++) pisos[ordem[k % ordem.length].i] += 1
  return pisos
}
