// Gasto energético e distribuição de macronutrientes.
//
// ⚠ LIMITE PROFISSIONAL, não cautela genérica: prescrição dietética no Brasil é
// atribuição privativa do nutricionista (Resolução CFN nº 600/2018). Este módulo
// produz ESTIMATIVA educativa. O vocabulário é deliberado — "estimar", "estimativa",
// "distribuição", "referência". Nunca "prescrever", "dieta", "recomendado", "meta".
// Todo resultado carrega ressalvaProfissional preenchida e o aviso correspondente.
import { arredondar, distribuirPorMaiorResto } from './numero'
import { erro, sucesso, type Aviso, type Calc, type Proveniencia, type Sexo } from './tipos'

export type EquacaoTmb = 'mifflin' | 'harrisBenedict' | 'katchMcArdle'
export type NivelAtividade = 'sedentario' | 'leve' | 'moderado' | 'intenso' | 'muitoIntenso'
export type Objetivo = 'deficit' | 'manutencao' | 'superavit'
export type BaseGordura = 'gPorKg' | 'percentualDasCalorias'

export const RESSALVA_PROFISSIONAL =
  'Estimativa educativa. A prescrição de dietas é atribuição privativa do nutricionista '
  + '(Resolução CFN nº 600/2018) — este número serve para embasar a conversa, não para orientar '
  + 'um plano alimentar.'

/** Reflete o dia inteiro, não só o treino — é a maior fonte de erro da conta. */
export const FATORES_ATIVIDADE: readonly { id: NivelAtividade; label: string; fator: number }[] = [
  { id: 'sedentario', label: 'Sedentário: trabalho parado e pouco ou nenhum exercício', fator: 1.2 },
  { id: 'leve', label: 'Leve: exercício 1 a 3 vezes por semana', fator: 1.375 },
  { id: 'moderado', label: 'Moderado: treina 3 a 5 vezes por semana', fator: 1.55 },
  { id: 'intenso', label: 'Intenso: treina 6 a 7 vezes por semana', fator: 1.725 },
  { id: 'muitoIntenso', label: 'Muito intenso: treino pesado diário ou trabalho braçal', fator: 1.9 },
]

export const OBJETIVOS: readonly { id: Objetivo; label: string; ajustePadrao: number }[] = [
  { id: 'deficit', label: 'Déficit', ajustePadrao: 0.2 },
  { id: 'manutencao', label: 'Manutenção', ajustePadrao: 0 },
  { id: 'superavit', label: 'Superávit', ajustePadrao: 0.1 },
]

export const MINIMO_SEGURO_KCAL: Record<Sexo, number> = { M: 1500, F: 1200 }

export const PROVENIENCIAS_ENERGIA: Record<string, Proveniencia> = {
  'mifflin-st-jeor-1990': { id: 'mifflin-st-jeor-1990', nome: 'Mifflin-St Jeor', autores: 'Mifflin, M.D. et al.', ano: 1990, populacao: 'Adultos não atletas', fonteVerificadaEm: '2026-08' },
  'harris-benedict-1984': { id: 'harris-benedict-1984', nome: 'Harris-Benedict revisada', autores: 'Roza, A.M.; Shizgal, H.M.', ano: 1984, publicacao: 'Am J Clin Nutr — revisão da equação de 1919', populacao: '337 adultos (168 homens, 169 mulheres)', n: 337, fonteVerificadaEm: '2026-08' },
  'katch-mcardle': { id: 'katch-mcardle', nome: 'Katch-McArdle', autores: 'Katch, F.; McArdle, W.', ano: 1996, populacao: 'Baseada em massa magra — exige percentual de gordura', fonteVerificadaEm: '2026-08' },
  'cfn-600-2018': { id: 'cfn-600-2018', nome: 'Resolução CFN nº 600/2018', autores: 'Conselho Federal de Nutricionistas', ano: 2018, populacao: 'Define a prescrição dietética como atribuição privativa do nutricionista', fonteVerificadaEm: '2026-08' },
}

export interface EntradaEnergia {
  sexo: Sexo
  pesoKg: number
  alturaCm: number
  idadeAnos: number
  nivelAtividade: NivelAtividade
  equacao?: EquacaoTmb
  percentualGordura?: number
  objetivo?: Objetivo
  ajustePercentual?: number
  proteinaGPorKg?: number
  gordura?: { base: BaseGordura; valor: number }
}

export interface Macronutriente {
  gramas: number
  kcal: number
  percentualDasCalorias: number
  gPorKg: number
}

export interface ResultadoEnergia {
  equacaoUsada: EquacaoTmb
  tmbKcal: number
  fatorAtividade: number
  gastoEnergeticoTotalKcal: number
  /** Estimativa após o ajuste do objetivo. Nunca chamado de meta. */
  caloriasEstimadasKcal: number
  massaMagraKg: number | null
  distribuicaoDeMacros: { proteina: Macronutriente; gordura: Macronutriente; carboidrato: Macronutriente }
  comparativoEquacoes: { equacao: EquacaoTmb; tmbKcal: number | null; indisponivelPorque?: string }[]
  provenienciaIds: string[]
  /** Obrigatório: a UI não renderiza resultado sem ter a ressalva em mãos. */
  ressalvaProfissional: string
}

export function estimarTmb(
  sexo: Sexo,
  pesoKg: number,
  alturaCm: number,
  idadeAnos: number,
  equacao: EquacaoTmb,
  percentualGordura?: number,
): number | null {
  if (equacao === 'mifflin') {
    return 10 * pesoKg + 6.25 * alturaCm - 5 * idadeAnos + (sexo === 'M' ? 5 : -161)
  }
  if (equacao === 'harrisBenedict') {
    return sexo === 'M'
      ? 88.362 + 13.397 * pesoKg + 4.799 * alturaCm - 5.677 * idadeAnos
      : 447.593 + 9.247 * pesoKg + 3.098 * alturaCm - 4.33 * idadeAnos
  }
  if (percentualGordura == null || !Number.isFinite(percentualGordura)) return null
  return 370 + 21.6 * (pesoKg * (1 - percentualGordura / 100))
}

export function estimarEnergia(e: EntradaEnergia): Calc<ResultadoEnergia> {
  const avisos: Aviso[] = []
  const { sexo, pesoKg, alturaCm, idadeAnos } = e

  if (!Number.isFinite(pesoKg) || pesoKg < 20 || pesoKg > 400) return erro([invalido('pesoKg', 'Informe um peso entre 20 e 400 kg.')])
  if (!Number.isFinite(alturaCm) || alturaCm < 100 || alturaCm > 250) return erro([invalido('alturaCm', 'Informe uma altura entre 100 e 250 cm.')])
  if (!Number.isFinite(idadeAnos) || idadeAnos < 10 || idadeAnos > 100) return erro([invalido('idadeAnos', 'Informe uma idade entre 10 e 100 anos.')])

  const nivel = FATORES_ATIVIDADE.find((f) => f.id === e.nivelAtividade)
  if (!nivel) return erro([invalido('nivelAtividade', 'Escolha um nível de atividade.')])

  const equacao = e.equacao ?? 'mifflin'
  if (equacao === 'katchMcArdle' && (e.percentualGordura == null || !Number.isFinite(e.percentualGordura))) {
    return erro([{
      codigo: 'KATCH_EXIGE_PERCENTUAL_DE_GORDURA',
      nivel: 'erro',
      campo: 'percentualGordura',
      mensagem: 'Katch-McArdle parte da massa magra e precisa do percentual de gordura.',
      correcao: 'Calcule o percentual em /calculadoras/dobras-cutaneas ou escolha outra equação.',
    }])
  }

  const tmbKcal = estimarTmb(sexo, pesoKg, alturaCm, idadeAnos, equacao, e.percentualGordura)!
  const gastoEnergeticoTotalKcal = tmbKcal * nivel.fator

  const objetivo = e.objetivo ?? 'manutencao'
  const defObjetivo = OBJETIVOS.find((o) => o.id === objetivo)!
  const ajuste = e.ajustePercentual ?? defObjetivo.ajustePadrao
  const sinal = objetivo === 'deficit' ? -1 : objetivo === 'superavit' ? 1 : 0
  const caloriasEstimadasKcal = gastoEnergeticoTotalKcal * (1 + sinal * ajuste)

  if (caloriasEstimadasKcal < MINIMO_SEGURO_KCAL[sexo]) {
    avisos.push({
      codigo: 'ABAIXO_DO_MINIMO_SEGURO',
      nivel: 'atencao',
      mensagem: `A estimativa (${arredondar(caloriasEstimadasKcal, 0)} kcal) fica abaixo de ${MINIMO_SEGURO_KCAL[sexo]} kcal, patamar que exige acompanhamento.`,
      correcao: 'Encaminhe ao nutricionista antes de considerar esse valor.',
      contexto: { estimado: arredondar(caloriasEstimadasKcal, 0), minimo: MINIMO_SEGURO_KCAL[sexo] },
    })
  }

  // Macros: proteína e gordura por parâmetro, carboidrato por diferença.
  const proteinaGPorKg = e.proteinaGPorKg ?? 1.8
  if (proteinaGPorKg > 3) {
    avisos.push({ codigo: 'PROTEINA_ACIMA_DO_USUAL', nivel: 'info', campo: 'proteinaGPorKg', mensagem: `${proteinaGPorKg} g/kg de proteína está acima do intervalo usual de 1,6 a 2,2 g/kg.`, contexto: { valor: proteinaGPorKg } })
  }
  const proteinaG = proteinaGPorKg * pesoKg
  const proteinaKcal = proteinaG * 4

  const cfgGordura = e.gordura ?? { base: 'percentualDasCalorias' as BaseGordura, valor: 0.25 }
  const gorduraKcal = cfgGordura.base === 'gPorKg'
    ? cfgGordura.valor * pesoKg * 9
    : caloriasEstimadasKcal * cfgGordura.valor
  const gorduraG = gorduraKcal / 9
  if (gorduraG / pesoKg < 0.5) {
    avisos.push({ codigo: 'GORDURA_ABAIXO_DO_USUAL', nivel: 'info', campo: 'gordura', mensagem: `${arredondar(gorduraG / pesoKg, 2)} g/kg de gordura fica abaixo de 0,5 g/kg, patamar associado a prejuízo hormonal.`, contexto: { gPorKg: arredondar(gorduraG / pesoKg, 2) } })
  }

  let carboidratoKcal = caloriasEstimadasKcal - proteinaKcal - gorduraKcal
  if (carboidratoKcal < 0) {
    avisos.push({
      codigo: 'MACROS_EXCEDEM_CALORIAS',
      nivel: 'atencao',
      mensagem: `Proteína e gordura sozinhas já somam ${arredondar(proteinaKcal + gorduraKcal, 0)} kcal, acima da estimativa de ${arredondar(caloriasEstimadasKcal, 0)} kcal.`,
      correcao: 'Reduza a proteína ou a gordura — a combinação atual é impossível.',
      contexto: { excedente: arredondar(proteinaKcal + gorduraKcal - caloriasEstimadasKcal, 0) },
    })
    carboidratoKcal = 0
  }
  const carboidratoG = carboidratoKcal / 4

  // Arredondar os três de forma independente faria a soma fugir do total exibido.
  const [pG, gG, cG] = distribuirPorMaiorResto(
    [proteinaG, gorduraG, carboidratoG],
    proteinaG + gorduraG + carboidratoG,
  )

  const macro = (gramas: number, kcalPorG: number): Macronutriente => ({
    gramas,
    kcal: arredondar(gramas * kcalPorG, 2),
    percentualDasCalorias: arredondar((gramas * kcalPorG * 100) / caloriasEstimadasKcal, 2),
    gPorKg: arredondar(gramas / pesoKg, 3),
  })

  const comparativoEquacoes = (['mifflin', 'harrisBenedict', 'katchMcArdle'] as EquacaoTmb[]).map((id) => {
    const v = estimarTmb(sexo, pesoKg, alturaCm, idadeAnos, id, e.percentualGordura)
    return v === null
      ? { equacao: id, tmbKcal: null, indisponivelPorque: 'Exige o percentual de gordura.' }
      : { equacao: id, tmbKcal: arredondar(v, 2) }
  })

  avisos.push({
    codigo: 'ESTIMATIVA_EDUCATIVA_NAO_PRESCRICAO',
    nivel: 'info',
    mensagem: RESSALVA_PROFISSIONAL,
  })

  const massaMagraKg = e.percentualGordura != null && Number.isFinite(e.percentualGordura)
    ? arredondar(pesoKg * (1 - e.percentualGordura / 100), 4)
    : null

  return sucesso(
    {
      equacaoUsada: equacao,
      tmbKcal: arredondar(tmbKcal, 2),
      fatorAtividade: nivel.fator,
      gastoEnergeticoTotalKcal: arredondar(gastoEnergeticoTotalKcal, 2),
      caloriasEstimadasKcal: arredondar(caloriasEstimadasKcal, 2),
      massaMagraKg,
      distribuicaoDeMacros: {
        proteina: macro(pG, 4),
        gordura: macro(gG, 9),
        carboidrato: macro(cG, 4),
      },
      comparativoEquacoes,
      provenienciaIds: [
        equacao === 'mifflin' ? 'mifflin-st-jeor-1990' : equacao === 'harrisBenedict' ? 'harris-benedict-1984' : 'katch-mcardle',
        'cfn-600-2018',
      ],
      ressalvaProfissional: RESSALVA_PROFISSIONAL,
    },
    avisos,
  )
}

function invalido(campo: string, mensagem: string): Aviso {
  return { codigo: 'FORA_DO_DOMINIO', nivel: 'erro', campo, mensagem }
}
