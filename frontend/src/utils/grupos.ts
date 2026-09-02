// Grupo muscular de um exercício — vocabulário canônico e leitura tolerante ao legado.
//
// Espelho de `backend/app/models/grupos_musculares.py` (CLAUDE.md: enums espelhados
// backend ↔ frontend). Um exercício atinge mais de um grupo, então a verdade é
// `grupos: string[]`; `grupo: string` continua existindo como `grupos.join(', ')` para os
// leitores que ainda esperam texto, e é o único campo dos itens antigos.
//
// `gruposDoExercicio` é o único ponto de leitura: quando só existe o `grupo` legado, ele quebra
// a string composta ("Peito, Tríceps") na lista que ela sempre quis ser — sem tocar no item.

import { normalizeText } from './normalizeText'

export const SEM_GRUPO = 'Sem grupo'

/** Vocabulário sugerido nos formulários e nos prompts. NÃO é uma lista fechada — o personal
 *  pode digitar um grupo próprio ("Adutores", "Oblíquos"). */
export const GRUPOS_MUSCULARES: readonly string[] = [
  'Peito',
  'Costas',
  'Ombros',
  'Trapézio',
  'Bíceps',
  'Tríceps',
  'Antebraço',
  'Quadríceps',
  'Posteriores de coxa',
  'Glúteos',
  'Panturrilhas',
  'Abdômen',
  'Core',
  'Full body',
  'Cardio',
]

// Separadores de um campo composto digitado à mão ou vindo de import. O " e " exige fronteira
// de palavra para não picar "Posteriores de coxa".
const SEPARADORES = /\s*(?:[,/+;&]|\be\b)\s*/i

export interface ComGrupos {
  grupos?: string[] | null
  grupo?: string | null
}

/** Quebra um campo `grupo` legado composto, preservando a grafia de cada parte. */
export function separarGrupos(grupo?: string | null): string[] {
  if (!grupo?.trim()) return []
  const vistos = new Set<string>()
  const saida: string[] = []
  for (const parte of grupo.split(SEPARADORES)) {
    const nome = parte.trim()
    if (!nome) continue
    const chave = normalizeText(nome)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    saida.push(nome)
  }
  return saida
}

/** Os grupos musculares de um exercício. Nunca vazio: sem informação, devolve ["Sem grupo"]. */
export function gruposDoExercicio(ex?: ComGrupos | null): string[] {
  if (!ex) return [SEM_GRUPO]
  if (ex.grupos?.length) {
    const vistos = new Set<string>()
    const saida: string[] = []
    for (const g of ex.grupos) {
      const nome = String(g).trim()
      if (!nome) continue
      const chave = normalizeText(nome)
      if (vistos.has(chave)) continue
      vistos.add(chave)
      saida.push(nome)
    }
    if (saida.length) return saida
  }
  const doLegado = separarGrupos(ex.grupo)
  return doLegado.length ? doLegado : [SEM_GRUPO]
}

/** A string que vai no campo `grupo` para quem ainda espera texto. */
export function grupoLegado(grupos?: string[] | null): string | undefined {
  const limpos = (grupos ?? []).map((g) => g.trim()).filter(Boolean)
  return limpos.length ? limpos.join(', ') : undefined
}

/** Sugestões do campo de chips: o vocabulário + o que o personal já usa, sem repetir. */
export function sugestoesDeGrupo(usados: Iterable<string | null | undefined>): string[] {
  const vistos = new Set(GRUPOS_MUSCULARES.map(normalizeText))
  const extras: string[] = []
  for (const bruto of usados) {
    for (const nome of separarGrupos(bruto)) {
      const chave = normalizeText(nome)
      if (vistos.has(chave)) continue
      vistos.add(chave)
      extras.push(nome)
    }
  }
  return [...GRUPOS_MUSCULARES, ...extras.sort((a, b) => a.localeCompare(b, 'pt-BR'))]
}
