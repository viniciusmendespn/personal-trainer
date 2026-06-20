import { api } from './client'
import type { Exercicio } from '../types'

export interface PontoEvolucao {
  data: string
  carga_max: number | null
  volume: number | null
  reps: string
}

export interface Evolucao {
  serie: PontoEvolucao[]
  pr: { carga: number; data: string } | null
  total_sessoes: number
}

export interface ResumoSemana {
  semana: string
  volume: number
  sessoes: number
}

export interface Resumo {
  total_sessoes: number
  total_volume: number
  ultimo_treino: string | null
  sessoes_semana: number
  semanas: ResumoSemana[]
  prs: { exercicio: string; carga: number; data: string }[]
  streak_atual?: number
  streak_maximo?: number
  multiplicador_atual?: number
  media_sessoes_semana?: number
}

export const evolucaoApi = {
  listExercicios: (alunoId: string) =>
    api.get<Exercicio[]>(`/v1/alunos/${alunoId}/exercicios`).then((r) => r.data),
  get: (alunoId: string, exercicioId: string) =>
    api.get<Evolucao>(`/v1/alunos/${alunoId}/exercicios/${exercicioId}/evolucao`).then((r) => r.data),
  resumo: (alunoId: string) =>
    api.get<Resumo>(`/v1/alunos/${alunoId}/resumo`).then((r) => r.data),
}
