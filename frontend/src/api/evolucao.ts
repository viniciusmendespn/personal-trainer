import { api } from './client'
import type { Exercicio } from '../types'

export interface PontoEvolucao {
  data: string
  carga_max?: number | null
  volume?: number | null
  reps?: string
  metrica_max?: number | null
  irm?: number | null
}

export interface Evolucao {
  tipo?: string
  direcao?: 'MAIOR' | 'MENOR'
  serie: PontoEvolucao[]
  pr: { carga: number; data: string } | null
  total_sessoes: number
  nome?: string | null
  chave?: string
}

/** Item do seletor de evolução (historico=1): identidade por nome canônico (chave). */
export interface ExercicioEvolucao {
  chave: string
  nome: string
  atual: boolean
  exercicio_id?: string | null
  exercicio_ids?: string[]
  tipo_exercicio?: string
  grupo?: string
  unidade_carga?: string
  unidade_reps?: string
  metrica_direcao?: 'MAIOR' | 'MENOR'
  rm_kg?: number
  carga_prescrita?: string
  wod?: boolean                   // entrada de WOD (chave "wod#...") — score do bloco
  formato?: string                // FOR_TIME | AMRAP | EMOM (quando wod)
}

export interface ResumoSemana {
  semana: string
  volume: number
  sessoes: number
  grupos?: Record<string, number>
}

export interface Resumo {
  total_sessoes: number
  total_volume: number
  ultimo_treino: string | null
  sessoes_semana: number
  semanas: ResumoSemana[]
  prs: {
    exercicio: string; carga: number; data: string; chave?: string
    direcao?: 'MAIOR' | 'MENOR'; formato?: string; wod?: boolean; unidade?: string | null; rx?: boolean
  }[]
  streak_atual?: number
  streak_maximo?: number
  multiplicador_atual?: number
  media_sessoes_semana?: number
  volume_por_grupo?: { grupo: string; volume: number }[]
  tempo_medio_segundos?: number | null       // duração média de treino
  tempo_medio_serie_segundos?: number | null // estimado (duração ÷ nº de séries, inclui descanso)
  dias_semana?: number[]                      // [seg..dom] contagem de execuções por dia da semana
}

export const evolucaoApi = {
  listExercicios: (alunoId: string) =>
    api.get<Exercicio[]>(`/v1/alunos/${alunoId}/exercicios`).then((r) => r.data),
  /** Todos os exercícios já feitos (programa atual + histórico), em ordem alfabética. */
  listExerciciosHistorico: (alunoId: string) =>
    api.get<ExercicioEvolucao[]>(`/v1/alunos/${alunoId}/exercicios`, { params: { historico: 1 } }).then((r) => r.data),
  get: (alunoId: string, exercicioId: string) =>
    api.get<Evolucao>(`/v1/alunos/${alunoId}/exercicios/${exercicioId}/evolucao`).then((r) => r.data),
  /** Evolução pelo nome canônico — funciona p/ exercício fora do programa atual. */
  getPorChave: (alunoId: string, chave: string) =>
    api.get<Evolucao>(`/v1/alunos/${alunoId}/exercicios/evolucao`, { params: { chave } }).then((r) => r.data),
  resumo: (alunoId: string) =>
    api.get<Resumo>(`/v1/alunos/${alunoId}/resumo`).then((r) => r.data),
}
