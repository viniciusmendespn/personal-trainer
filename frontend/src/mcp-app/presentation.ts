import type { Aluno } from './types'

export const labels: Record<string, string> = {
  series_prescritas: 'Séries, repetições e carga', intervalo_s: 'Intervalo (s)', observacoes: 'Observações',
  data_inicio: 'Início', data_fim: 'Fim', ativo: 'Ativo', nome: 'Nome', foco: 'Foco', ordem: 'Ordem',
  video_url: 'Vídeo', substitutos: 'Substitutos', grupos: 'Grupos musculares', grupo: 'Grupo',
  tipo_exercicio: 'Tipo de exercício', unidade_carga: 'Unidade da carga', unidade_reps: 'Unidade da métrica',
  metrica_direcao: 'Direção do recorde', blocos: 'Blocos', bloco_id: 'Bloco', aquecimento: 'Aquecimento',
  reps: 'Repetições / métrica', carga: 'Carga', series: 'Séries', formato: 'Formato', duracao_s: 'Duração (s)',
}
export function formatValue(value: unknown): string {
  if (value == null || value === '') return 'Não informado'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(' · ') : 'Nenhum'
  if (typeof value === 'object') return Object.entries(value).filter(([k, v]) => !['origem_id', 'ref'].includes(k) && v != null)
    .map(([k, v]) => `${labels[k] ?? k.replaceAll('_', ' ')}: ${formatValue(v)}`).join('; ')
  return String(value)
}
export function ordenarAlunos(items: Aluno[], ordem: string): Aluno[] {
  return [...items].sort((a, b) => (ordem === 'urgencia' ? a.urgencia - b.urgencia : 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
}
export function estadoLabel(estado: string) {
  return ({ valida: 'Proposta — ainda não aplicada', invalida: 'Corrija os erros antes de aplicar',
    desatualizada: 'Programa alterado — revise uma nova proposta', expirada: 'Proposta expirada',
    aplicada: 'Programa aplicado', descartada: 'Proposta descartada' } as Record<string, string>)[estado] ?? 'Rascunho'
}
