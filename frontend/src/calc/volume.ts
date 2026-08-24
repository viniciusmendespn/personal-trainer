// Volume semanal de treino por grupo muscular.
//
// Base: Schoenfeld, Ogborn & Krieger (2017), J Sports Sci — relação dose-resposta
// graduada, ~0,38% de hipertrofia por série adicional.
//
// O fator 0,5 para série indireta NÃO é convenção de internet: a meta-regressão da
// Sports Medicine (2025, 67 estudos, 2.058 participantes) mostrou que a contagem
// fracionária explica os ganhos melhor que contar 1 ou 0. Ainda assim o fator é
// parâmetro, e todo resultado carrega o aviso dizendo que a aplicação individual é
// convenção do produto e não achado do estudo.
import { arredondar } from './numero'
import { erro, sucesso, type Aviso, type Calc, type Proveniencia } from './tipos'

export type GrupoMuscular =
  | 'peito' | 'costas' | 'ombros' | 'trapezio' | 'biceps' | 'triceps'
  | 'antebraco' | 'quadriceps' | 'posteriores' | 'gluteos' | 'panturrilhas' | 'abdomen'

export const GRUPO_LABELS: Record<GrupoMuscular, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombros: 'Ombros',
  trapezio: 'Trapézio',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebraco: 'Antebraço',
  quadriceps: 'Quadríceps',
  posteriores: 'Posteriores de coxa',
  gluteos: 'Glúteos',
  panturrilhas: 'Panturrilhas',
  abdomen: 'Abdômen',
}

export type FaixaVolume = 'abaixo_do_minimo' | 'minimo_efetivo' | 'faixa_alvo' | 'alem_da_evidencia'

export const FAIXAS: readonly { faixa: FaixaVolume; min: number; max: number; rotulo: string }[] = [
  { faixa: 'abaixo_do_minimo', min: 0, max: 5, rotulo: 'Abaixo do mínimo' },
  { faixa: 'minimo_efetivo', min: 5, max: 10, rotulo: 'Mínimo efetivo' },
  { faixa: 'faixa_alvo', min: 10, max: 20, rotulo: 'Faixa alvo' },
  { faixa: 'alem_da_evidencia', min: 20, max: Infinity, rotulo: 'Além do que a evidência cobre' },
]

export const FATOR_SERIE_INDIRETA_PADRAO = 0.5
const GANHO_POR_SERIE_PCT = 0.38
const BASE_GANHO_SERIES = 5

export const PROVENIENCIA_VOLUME: Proveniencia = {
  id: 'schoenfeld-2017',
  nome: 'Dose-resposta entre volume semanal e hipertrofia',
  autores: 'Schoenfeld, B.J.; Ogborn, D.; Krieger, J.W.',
  ano: 2017,
  publicacao: 'Journal of Sports Sciences — 34 grupos de tratamento, 15 estudos',
  populacao: 'Praticantes de treinamento de força',
  fonteVerificadaEm: '2026-08',
  observacao: 'Relação graduada ENTRE estudos (~0,38% por série adicional), não preditor individual. O fator de 0,5 para série indireta vem da meta-regressão da Sports Medicine (2025) e a sua aplicação aqui é convenção do CoachPilot.',
}

export interface EntradaGrupo {
  grupo: GrupoMuscular
  seriesDiretasPorSessao: number
  seriesIndiretasPorSessao?: number
  frequenciaSemanal: number
}

export interface EntradaVolume {
  grupos: EntradaGrupo[]
  /** Convenção do produto, não achado da meta-análise. Default 0,5. */
  fatorSerieIndireta?: number
}

export interface ResultadoGrupo {
  grupo: GrupoMuscular
  label: string
  seriesDiretasSemana: number
  seriesIndiretasSemana: number
  seriesEfetivasSemana: number
  faixa: FaixaVolume
  rotulo: string
  /** Quantas séries faltam para entrar na faixa alvo. 0 se já está. */
  seriesAteFaixaAlvo: number
  /** Extrapolação do gradiente de 0,38%/série sobre base de 5. null fora de 5–20. */
  ganhoRelativoEstimadoPct: number | null
}

export interface ResultadoVolume {
  grupos: ResultadoGrupo[]
  fatorSerieIndireta: number
  totalSeriesEfetivasSemana: number
  provenienciaId: string
}

export function classificarVolume(series: number): { faixa: FaixaVolume; rotulo: string } {
  const f = FAIXAS.find((x) => series >= x.min && series < x.max) ?? FAIXAS[FAIXAS.length - 1]
  return { faixa: f.faixa, rotulo: f.rotulo }
}

export function calcularVolume(e: EntradaVolume): Calc<ResultadoVolume> {
  const fator = e.fatorSerieIndireta ?? FATOR_SERIE_INDIRETA_PADRAO
  if (!Number.isFinite(fator) || fator < 0 || fator > 1) {
    return erro([{ codigo: 'FORA_DO_DOMINIO', nivel: 'erro', campo: 'fatorSerieIndireta', mensagem: 'O fator de série indireta precisa ficar entre 0 e 1.' }])
  }
  if (!e.grupos.length) {
    return erro([{ codigo: 'CAMPO_OBRIGATORIO', nivel: 'erro', campo: 'grupos', mensagem: 'Informe pelo menos um grupo muscular.' }])
  }

  for (const g of e.grupos) {
    if (!Number.isFinite(g.frequenciaSemanal) || g.frequenciaSemanal <= 0 || g.frequenciaSemanal > 14) {
      return erro([{ codigo: 'FORA_DO_DOMINIO', nivel: 'erro', campo: 'frequenciaSemanal', mensagem: 'A frequência precisa ser de 1 a 14 sessões por semana.' }])
    }
    if (!Number.isFinite(g.seriesDiretasPorSessao) || g.seriesDiretasPorSessao < 0) {
      return erro([{ codigo: 'FORA_DO_DOMINIO', nivel: 'erro', campo: 'seriesDiretasPorSessao', mensagem: 'Séries não podem ser negativas.' }])
    }
    const ind = g.seriesIndiretasPorSessao ?? 0
    if (!Number.isFinite(ind) || ind < 0) {
      return erro([{ codigo: 'FORA_DO_DOMINIO', nivel: 'erro', campo: 'seriesIndiretasPorSessao', mensagem: 'Séries não podem ser negativas.' }])
    }
  }

  // Grupo repetido agrega em vez de duplicar linha.
  const somado = new Map<GrupoMuscular, { diretas: number; indiretas: number }>()
  for (const g of e.grupos) {
    const atual = somado.get(g.grupo) ?? { diretas: 0, indiretas: 0 }
    atual.diretas += g.seriesDiretasPorSessao * g.frequenciaSemanal
    atual.indiretas += (g.seriesIndiretasPorSessao ?? 0) * g.frequenciaSemanal
    somado.set(g.grupo, atual)
  }

  const avisos: Aviso[] = [{
    codigo: 'FATOR_INDIRETO_E_CONVENCAO',
    nivel: 'info',
    mensagem: `Série indireta está contando como ${fator} série. A meta-regressão da Sports Medicine (2025) indica que a contagem fracionária é a que melhor explica os ganhos, mas Schoenfeld (2017) contou séries diretas — aplicar o fator é convenção do CoachPilot.`,
    contexto: { fator },
  }]

  const grupos: ResultadoGrupo[] = []
  for (const [grupo, { diretas, indiretas }] of somado) {
    const efetivas = arredondar(diretas + indiretas * fator, 4)
    const { faixa, rotulo } = classificarVolume(efetivas)
    const ganho = efetivas >= BASE_GANHO_SERIES && efetivas <= 20
      ? arredondar((efetivas - BASE_GANHO_SERIES) * GANHO_POR_SERIE_PCT, 4)
      : null

    grupos.push({
      grupo,
      label: GRUPO_LABELS[grupo],
      seriesDiretasSemana: arredondar(diretas, 4),
      seriesIndiretasSemana: arredondar(indiretas, 4),
      seriesEfetivasSemana: efetivas,
      faixa,
      rotulo,
      seriesAteFaixaAlvo: efetivas >= 10 ? 0 : arredondar(10 - efetivas, 4),
      ganhoRelativoEstimadoPct: ganho,
    })

    if (faixa === 'abaixo_do_minimo') {
      avisos.push({
        codigo: 'VOLUME_ABAIXO_DO_MINIMO',
        nivel: 'atencao',
        campo: grupo,
        mensagem: `${GRUPO_LABELS[grupo]}: ${efetivas} séries por semana ficam abaixo das 5 que a literatura trata como mínimo efetivo.`,
        contexto: { series: efetivas, minimo: 5 },
      })
    }
    if (faixa === 'alem_da_evidencia') {
      avisos.push({
        codigo: 'VOLUME_ALEM_DA_EVIDENCIA',
        nivel: 'info',
        campo: grupo,
        mensagem: `${GRUPO_LABELS[grupo]}: ${efetivas} séries por semana passam da faixa coberta pelos estudos. Não significa que seja demais — significa que não há dado para estimar o retorno.`,
        contexto: { series: efetivas },
      })
    }
  }

  return sucesso(
    {
      grupos,
      fatorSerieIndireta: fator,
      totalSeriesEfetivasSemana: arredondar(grupos.reduce((t, g) => t + g.seriesEfetivasSemana, 0), 4),
      provenienciaId: PROVENIENCIA_VOLUME.id,
    },
    avisos,
  )
}
