import { useQuery } from '@tanstack/react-query'
import { evolucaoApi } from '../api/evolucao'

export function useExerciciosAluno(alunoId: string) {
  return useQuery({
    queryKey: ['exercicios-aluno', alunoId],
    queryFn: () => evolucaoApi.listExercicios(alunoId),
    enabled: !!alunoId,
  })
}

/** Todos os exercícios já feitos (programa atual + histórico), identidade por chave. */
export function useExerciciosAlunoHistorico(alunoId: string) {
  return useQuery({
    queryKey: ['exercicios-aluno-historico', alunoId],
    queryFn: () => evolucaoApi.listExerciciosHistorico(alunoId),
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

export function useEvolucaoPorChave(alunoId: string, chave: string) {
  return useQuery({
    queryKey: ['evolucao-chave', alunoId, chave],
    queryFn: () => evolucaoApi.getPorChave(alunoId, chave),
    enabled: !!alunoId && !!chave,
  })
}

export function useResumo(alunoId: string) {
  return useQuery({
    queryKey: ['resumo', alunoId],
    queryFn: () => evolucaoApi.resumo(alunoId),
    enabled: !!alunoId,
  })
}
