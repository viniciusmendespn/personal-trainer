// Contrato compartilhado pelas cinco calculadoras públicas (src/calc/).
// Nada aqui tem lógica — é só o formato que a UI e o texto prerenderizado consomem.

export type Sexo = 'M' | 'F'
export type Confianca = 'alta' | 'media' | 'baixa'
export type NivelAviso = 'info' | 'atencao' | 'erro'

/** Códigos estáveis: a UI e os testes dependem deles. A mensagem pode mudar; o código, não. */
export type CodigoAviso =
  // entrada
  | 'CAMPO_OBRIGATORIO'
  | 'VALOR_NAO_NUMERICO'
  | 'FORA_DO_DOMINIO'
  | 'SEPARADOR_AMBIGUO'
  // 1RM
  | 'REPS_ALTAS_BAIXA_CONFIANCA'
  | 'PERCENTUAL_INTERPOLADO'
  // dobras
  | 'IDADE_FORA_DA_VALIDADE'
  | 'DOBRA_IMPLAUSIVEL'
  | 'DENSIDADE_IMPLAUSIVEL'
  | 'ABAIXO_DA_GORDURA_ESSENCIAL'
  // precificação
  | 'META_ACIMA_DA_CAPACIDADE'
  | 'OCUPACAO_IRREAL'
  | 'TETO_MEI_ESTOURADO'
  | 'PRECO_FORA_DA_REFERENCIA_DE_MERCADO'
  // volume
  | 'VOLUME_ABAIXO_DO_MINIMO'
  | 'VOLUME_ALEM_DA_EVIDENCIA'
  | 'FATOR_INDIRETO_E_CONVENCAO'
  // energia
  | 'ABAIXO_DO_MINIMO_SEGURO'
  | 'MACROS_EXCEDEM_CALORIAS'
  | 'PROTEINA_ACIMA_DO_USUAL'
  | 'GORDURA_ABAIXO_DO_USUAL'
  | 'KATCH_EXIGE_PERCENTUAL_DE_GORDURA'
  | 'ESTIMATIVA_EDUCATIVA_NAO_PRESCRICAO'

/** Mesmo formato de ProblemaImport (utils/erroApi.ts): a UI já sabe renderizar esta forma. */
export interface Aviso {
  codigo: CodigoAviso
  nivel: NivelAviso
  /** Caminho navegável do campo: 'reps', 'dobrasMm.triceps', 'taxaOcupacao'. */
  campo?: string
  mensagem: string
  /** O que fazer a respeito. Ausente quando o aviso é só informativo. */
  correcao?: string
  /** Números que a UI destaca: { valor: 2.24, minimo: 3 }. */
  contexto?: Record<string, number | string>
}

/**
 * Nunca lança por entrada ruim — devolve ok:false com avisos. `resultado: null`
 * no ramo falso evita ginástica de narrowing em quem consome.
 */
export type Calc<T> =
  | { ok: true; resultado: T; avisos: Aviso[] }
  | { ok: false; resultado: null; avisos: Aviso[] }

/** Procedência de cada fórmula — vira conteúdo indexável na página, não só comentário. */
export interface Proveniencia {
  id: string
  nome: string
  autores: string
  ano: number
  publicacao?: string
  populacao: string
  faixaEtaria?: { min: number; max: number }
  sexo?: Sexo
  n?: number
  erroTipicoPct?: number
  /** Desmistificações e alertas de transcrição (ex.: o mito do Faulkner/nadadores). */
  observacao?: string
  /** 'AAAA-MM' */
  fonteVerificadaEm: string
}

export function erro(avisos: Aviso[]): Calc<never> {
  return { ok: false, resultado: null, avisos }
}

export function sucesso<T>(resultado: T, avisos: Aviso[] = []): Calc<T> {
  return { ok: true, resultado, avisos }
}
