/**
 * Normaliza texto para busca: remove acentos/diacríticos, passa para minúsculas e apara espaços.
 * Assim "triceps" acha "Tríceps" e a busca fica case- e accent-insensitive.
 * Usar nos dois lados de comparações de filtro (query e rótulo).
 */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Conveniência: `query` casa como substring de `target`, ignorando acento e caixa. */
export function matchesQuery(target: string | null | undefined, query: string): boolean {
  const q = normalizeText(query)
  return q === '' || normalizeText(target).includes(q)
}

/**
 * Chave canônica do nome do exercício — espelho do `chave_exercicio` do backend
 * (sem acento, minúsculas, espaços internos colapsados). É a identidade estável do
 * exercício em feed/evolução/PR: "Supino Reto" ≡ "supíno  reto".
 */
export function chaveExercicio(nome: string | null | undefined): string {
  return normalizeText(nome).split(/\s+/).filter(Boolean).join(' ')
}
