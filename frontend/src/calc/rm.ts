// Estimativa de 1RM (uma repetição máxima) e conversão em carga por intensidade.
import { arredondar, arredondarCarga, type IncrementoCarga, type ModoArredondamento } from './numero'
import { erro, sucesso, type Aviso, type Calc, type Confianca, type Proveniencia } from './tipos'

export type FormulaRm = 'epley' | 'brzycki' | 'lombardi' | 'oconner' | 'lander' | 'mayhew' | 'wathen'

export const RM_LIMITES = {
  carga: { min: 1, max: 1000 },
  reps: { min: 1, max: 12 },
} as const

const EQUACOES: Record<FormulaRm, (w: number, r: number) => number> = {
  epley: (w, r) => w * (1 + r / 30),
  brzycki: (w, r) => (w * 36) / (37 - r),
  lombardi: (w, r) => w * Math.pow(r, 0.1),
  oconner: (w, r) => w * (1 + 0.025 * r),
  lander: (w, r) => (100 * w) / (101.3 - 2.67123 * r),
  mayhew: (w, r) => (100 * w) / (52.2 + 41.9 * Math.exp(-0.055 * r)),
  wathen: (w, r) => (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r)),
}

export const FORMULAS_RM: readonly { id: FormulaRm; label: string; equacao: string }[] = [
  { id: 'epley', label: 'Epley', equacao: '1RM = w × (1 + r/30)' },
  { id: 'brzycki', label: 'Brzycki', equacao: '1RM = w × 36 / (37 − r)' },
  { id: 'lombardi', label: 'Lombardi', equacao: '1RM = w × r^0,10' },
  { id: 'oconner', label: 'O’Conner', equacao: '1RM = w × (1 + 0,025r)' },
  { id: 'lander', label: 'Lander', equacao: '1RM = 100w / (101,3 − 2,67123r)' },
  { id: 'mayhew', label: 'Mayhew', equacao: '1RM = 100w / (52,2 + 41,9·e^(−0,055r))' },
  { id: 'wathen', label: 'Wathen', equacao: '1RM = 100w / (48,8 + 53,8·e^(−0,075r))' },
]

/**
 * Tabela oficial do NSCA Training Load Chart, adaptada de Landers, J.
 * "Maximum based on reps", NSCA Journal 6(6):60-61, 1984.
 *
 * 11 repetições NÃO existe na fonte. A ausência é intencional: interpolar seria
 * apresentar como referência oficial um valor que a tabela não traz.
 */
export const TABELA_NSCA: readonly { reps: number; percentual: number }[] = [
  { reps: 1, percentual: 100 },
  { reps: 2, percentual: 95 },
  { reps: 3, percentual: 93 },
  { reps: 4, percentual: 90 },
  { reps: 5, percentual: 87 },
  { reps: 6, percentual: 85 },
  { reps: 7, percentual: 83 },
  { reps: 8, percentual: 80 },
  { reps: 9, percentual: 77 },
  { reps: 10, percentual: 75 },
  { reps: 12, percentual: 70 },
]

export const PROVENIENCIA_NSCA: Proveniencia = {
  id: 'nsca-landers-1984',
  nome: 'NSCA Training Load Chart',
  autores: 'Landers, J.',
  ano: 1984,
  publicacao: 'NSCA Journal 6(6):60-61 — tabela adaptada, © 2012 NSCA',
  populacao: 'Referência de prescrição de carga em treinamento de força',
  fonteVerificadaEm: '2026-08',
  observacao: 'A tabela original não traz 11 repetições.',
}

export interface EntradaRm {
  cargaKg: number
  reps: number
  formulas?: FormulaRm[]
}

export interface EstimativaRm {
  formula: FormulaRm
  label: string
  umRmKg: number
}

export interface ResultadoRm {
  entrada: { cargaKg: number; reps: number }
  estimativas: EstimativaRm[]
  medianaKg: number
  mediaKg: number
  faixa: { minKg: number; maxKg: number; amplitudePct: number }
  confianca: Confianca
  erroTipicoPct: number
}

export function estimar1Rm(e: EntradaRm): Calc<ResultadoRm> {
  const avisos: Aviso[] = []
  const { cargaKg, reps } = e

  if (!Number.isFinite(cargaKg) || cargaKg < RM_LIMITES.carga.min || cargaKg > RM_LIMITES.carga.max) {
    return erro([foraDoDominio('cargaKg', `Informe uma carga entre ${RM_LIMITES.carga.min} e ${RM_LIMITES.carga.max} kg.`)])
  }
  if (!Number.isInteger(reps) || reps < RM_LIMITES.reps.min || reps > RM_LIMITES.reps.max) {
    return erro([foraDoDominio('reps', `Informe um número inteiro de 1 a ${RM_LIMITES.reps.max} repetições.`)])
  }

  const ids = e.formulas?.length ? e.formulas : FORMULAS_RM.map((f) => f.id)
  const estimativas: EstimativaRm[] = ids.map((id) => ({
    formula: id,
    label: FORMULAS_RM.find((f) => f.id === id)!.label,
    // Curto-circuito obrigatório: com 1 repetição o 1RM É a carga. Sem isto, Mayhew
    // devolveria 130,6 kg para quem levantou 120 kg uma vez.
    umRmKg: reps === 1 ? cargaKg : arredondar(EQUACOES[id](cargaKg, reps), 4),
  }))

  const valores = estimativas.map((x) => x.umRmKg).sort((a, b) => a - b)
  const meio = Math.floor(valores.length / 2)
  const medianaKg = valores.length % 2 === 1 ? valores[meio] : (valores[meio - 1] + valores[meio]) / 2
  const mediaKg = valores.reduce((a, b) => a + b, 0) / valores.length
  const minKg = valores[0]
  const maxKg = valores[valores.length - 1]

  const confianca: Confianca = reps <= 10 ? 'alta' : 'baixa'
  const erroTipicoPct = reps <= 10 ? 5 : 18
  if (reps > 10) {
    avisos.push({
      codigo: 'REPS_ALTAS_BAIXA_CONFIANCA',
      nivel: 'atencao',
      campo: 'reps',
      mensagem: 'Acima de 10 repetições a estimativa perde precisão: as fórmulas divergem entre si em 15% a 20%.',
      correcao: 'Para uma estimativa confiável, use uma série de 3 a 6 repetições levada perto da falha.',
      contexto: { reps, erroTipicoPct },
    })
  }

  return sucesso(
    {
      entrada: { cargaKg, reps },
      estimativas,
      medianaKg: arredondar(medianaKg, 4),
      mediaKg: arredondar(mediaKg, 4),
      faixa: {
        minKg,
        maxKg,
        amplitudePct: arredondar(((maxKg - minKg) / medianaKg) * 100, 4),
      },
      confianca,
      erroTipicoPct,
    },
    avisos,
  )
}

export interface LinhaCarga {
  reps: number
  percentual: number
  /** true só em 11 reps: não existe na tabela NSCA oficial. */
  interpolado: boolean
  cargaKg: number
  cargaArredondadaKg: number
}

export interface EntradaTabelaCargas {
  umRmKg: number
  incremento?: IncrementoCarga
  modo?: ModoArredondamento
  /** Inclui 11 reps por interpolação (72,5%), marcado como tal. Default false. */
  incluirInterpolados?: boolean
}

export function tabelaDeCargas(e: EntradaTabelaCargas): Calc<{ umRmKg: number; linhas: LinhaCarga[] }> {
  if (!Number.isFinite(e.umRmKg) || e.umRmKg <= 0) {
    return erro([foraDoDominio('umRmKg', 'Informe um 1RM maior que zero.')])
  }
  const incremento = e.incremento ?? 'kg2_5'
  const modo = e.modo ?? 'abaixo'
  const avisos: Aviso[] = []

  const base = TABELA_NSCA.map((linha) => ({ ...linha, interpolado: false }))
  if (e.incluirInterpolados) {
    base.push({ reps: 11, percentual: 72.5, interpolado: true })
    base.sort((a, b) => a.reps - b.reps)
    avisos.push({
      codigo: 'PERCENTUAL_INTERPOLADO',
      nivel: 'info',
      mensagem: '11 repetições não consta na tabela da NSCA. O valor de 72,5% é interpolação entre 10 reps (75%) e 12 reps (70%).',
      contexto: { entre: '10 (75%) e 12 (70%)', adotado: 72.5 },
    })
  }

  const linhas: LinhaCarga[] = base.map((linha) => {
    const cargaKg = (e.umRmKg * linha.percentual) / 100
    return {
      reps: linha.reps,
      percentual: linha.percentual,
      interpolado: linha.interpolado,
      cargaKg: arredondar(cargaKg, 2),
      cargaArredondadaKg: arredondarCarga(cargaKg, incremento, modo),
    }
  })

  return sucesso({ umRmKg: e.umRmKg, linhas }, avisos)
}

export function cargaParaPercentual(
  umRmKg: number,
  percentual: number,
  incremento: IncrementoCarga = 'kg2_5',
  modo: ModoArredondamento = 'abaixo',
): number {
  return arredondarCarga((umRmKg * percentual) / 100, incremento, modo)
}

function foraDoDominio(campo: string, mensagem: string): Aviso {
  return { codigo: 'FORA_DO_DOMINIO', nivel: 'erro', campo, mensagem }
}
