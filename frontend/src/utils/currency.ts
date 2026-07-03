/** Formata um valor em reais (número) como moeda BRL. Ex.: 149.9 → "R$ 149,90". */
export function formatBRL(reais: number | null | undefined): string {
  return (reais ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
