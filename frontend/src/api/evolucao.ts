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

export const evolucaoApi = {
  listExercicios: (alunoId: string) =>
    api.get<Exercicio[]>(`/v1/alunos/${alunoId}/exercicios`).then((r) => r.data),
  get: (alunoId: string, exercicioId: string) =>
    api.get<Evolucao>(`/v1/alunos/${alunoId}/exercicios/${exercicioId}/evolucao`).then((r) => r.data),
}
