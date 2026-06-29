import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { treinosApi } from '../api/treinos'
import type { ExercicioCreate, TreinoCreate } from '../types'

export function useTreinos(alunoId: string) {
  return useQuery({
    queryKey: ['treinos', alunoId],
    queryFn: () => treinosApi.list(alunoId),
    enabled: !!alunoId,
  })
}

export function useCreateTreino(alunoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TreinoCreate) => treinosApi.create(alunoId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['treinos', alunoId] }),
  })
}

export function useUpdateTreino(alunoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ treinoId, body }: { treinoId: string; body: TreinoCreate }) =>
      treinosApi.update(alunoId, treinoId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['treinos', alunoId] }),
  })
}

export function useDeleteTreino(alunoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (treinoId: string) => treinosApi.remove(alunoId, treinoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['treinos', alunoId] }),
  })
}

export function useExportarPrograma() {
  return useMutation({
    mutationFn: (alunoId: string) => treinosApi.exportarPrograma(alunoId),
  })
}

export function useImportarPrograma(alunoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conteudo: string) => treinosApi.importarPrograma(alunoId, conteudo),
    onSuccess: () => {
      // substituição total: invalida treinos + exercícios do aluno + biblioteca (auto-cadastro)
      qc.invalidateQueries({ queryKey: ['treinos', alunoId] })
      qc.invalidateQueries({ queryKey: ['exercicios'] })
      qc.invalidateQueries({ queryKey: ['exercicios-aluno', alunoId] })
      qc.invalidateQueries({ queryKey: ['biblioteca'] })
    },
  })
}

export function useExercicios(alunoId: string, treinoId: string) {
  return useQuery({
    queryKey: ['exercicios', alunoId, treinoId],
    queryFn: () => treinosApi.listExercicios(alunoId, treinoId),
    enabled: !!alunoId && !!treinoId,
  })
}

export function useCreateExercicio(alunoId: string, treinoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ExercicioCreate) => treinosApi.createExercicio(alunoId, treinoId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercicios', alunoId, treinoId] })
      qc.invalidateQueries({ queryKey: ['exercicios-aluno', alunoId] })
      qc.invalidateQueries({ queryKey: ['biblioteca'] }) // auto-cadastro na biblioteca
    },
  })
}

export function useUpdateExercicio(alunoId: string, treinoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ exercicioId, body }: { exercicioId: string; body: ExercicioCreate }) =>
      treinosApi.updateExercicio(alunoId, treinoId, exercicioId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercicios', alunoId, treinoId] })
      qc.invalidateQueries({ queryKey: ['exercicios-aluno', alunoId] })
      qc.invalidateQueries({ queryKey: ['biblioteca'] }) // renomear pode gerar item novo
    },
  })
}

export function useDeleteExercicio(alunoId: string, treinoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (exercicioId: string) => treinosApi.removeExercicio(alunoId, treinoId, exercicioId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercicios', alunoId, treinoId] })
      qc.invalidateQueries({ queryKey: ['exercicios-aluno', alunoId] })
    },
  })
}

export function useMidiaExercicio(alunoId: string, exercicioId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['midia-exercicio', alunoId, exercicioId],
    queryFn: () => treinosApi.listMidia(alunoId, exercicioId),
    enabled: enabled && !!alunoId && !!exercicioId,
  })
}
