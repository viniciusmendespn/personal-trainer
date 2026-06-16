import { useQuery } from '@tanstack/react-query'
import { evolucaoApi } from '../api/evolucao'

export function useExerciciosAluno(alunoId: string) {
  return useQuery({
    queryKey: ['exercicios-aluno', alunoId],
    queryFn: () => evolucaoApi.listExercicios(alunoId),
    enabled: !!alunoId,
  })
}

export function useEvolucao(alunoId: string, exercicioId: string) {
  return useQuery({
    queryKey: ['evolucao', alunoId, exercicioId],
    queryFn: () => evolucaoApi.get(alunoId, exercicioId),
    enabled: !!alunoId && !!exercicioId,
  })
}
