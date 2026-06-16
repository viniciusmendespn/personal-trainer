import { api } from './client'
import type { Exercicio, ExercicioCreate, Treino, TreinoCreate } from '../types'

export const treinosApi = {
  list: (alunoId: string) =>
    api.get<Treino[]>(`/v1/alunos/${alunoId}/treinos`).then((r) => r.data),
  create: (alunoId: string, body: TreinoCreate) =>
    api.post<Treino>(`/v1/alunos/${alunoId}/treinos`, body).then((r) => r.data),
  update: (alunoId: string, treinoId: string, body: TreinoCreate) =>
    api.put<Treino>(`/v1/alunos/${alunoId}/treinos/${treinoId}`, body).then((r) => r.data),
  remove: (alunoId: string, treinoId: string) =>
    api.delete(`/v1/alunos/${alunoId}/treinos/${treinoId}`),

  listExercicios: (alunoId: string, treinoId: string) =>
    api.get<Exercicio[]>(`/v1/alunos/${alunoId}/treinos/${treinoId}/exercicios`).then((r) => r.data),
  createExercicio: (alunoId: string, treinoId: string, body: ExercicioCreate) =>
    api
      .post<Exercicio>(`/v1/alunos/${alunoId}/treinos/${treinoId}/exercicios`, body)
      .then((r) => r.data),
  removeExercicio: (alunoId: string, treinoId: string, exercicioId: string) =>
    api.delete(`/v1/alunos/${alunoId}/treinos/${treinoId}/exercicios/${exercicioId}`),
}
