import type { Ferias } from '../api/ferias'

const MIN_DATA = '0000-01-01'
const MAX_DATA = '9999-12-31'

/** Formata YYYY-MM-DD → DD/MM (para textos curtos). */
export function formatDiaMes(dataIso: string): string {
  const p = (dataIso || '').split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}` : dataIso
}

/**
 * Retorna os períodos de férias que se sobrepõem à vigência de um treino.
 * Datas em string YYYY-MM-DD (comparação lexicográfica, mesma técnica do backend).
 * Vigência aberta: sem data_fim → futuro infinito; sem data_inicio → passado infinito.
 * Treino sem nenhuma data → nada a comparar (retorna []).
 */
export function feriasSobrepostas(
  dataInicio: string | null | undefined,
  dataFim: string | null | undefined,
  ferias: Ferias[],
): Ferias[] {
  if (!dataInicio && !dataFim) return []
  const ti = dataInicio || MIN_DATA
  const tf = dataFim || MAX_DATA
  return ferias.filter((f) => f.data_inicio && f.data_fim && ti <= f.data_fim && f.data_inicio <= tf)
}
