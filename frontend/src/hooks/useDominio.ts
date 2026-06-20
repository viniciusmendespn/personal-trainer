import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { avaliacoesApi, type AvaliacaoCreate } from '../api/avaliacoes'
import { bibliotecaApi, type ExLibCreate } from '../api/biblioteca'
import type { ImportarResult } from '../api/biblioteca'

export function useAvaliacoes(alunoId: string) {
  return useQuery({
    queryKey: ['avaliacoes', alunoId],
    queryFn: () => avaliacoesApi.list(alunoId),
    enabled: !!alunoId,
  })
}

export function useCreateAvaliacao(alunoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AvaliacaoCreate) => avaliacoesApi.create(alunoId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avaliacoes', alunoId] }),
  })
}

export function useDeleteAvaliacao(alunoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tsId: string) => avaliacoesApi.remove(alunoId, tsId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avaliacoes', alunoId] }),
  })
}

export function useBiblioteca() {
  return useQuery({ queryKey: ['biblioteca'], queryFn: bibliotecaApi.list })
}

export function useCreateExLib() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ExLibCreate) => bibliotecaApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biblioteca'] }),
  })
}

export function useUpdateExLib() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ExLibCreate }) => bibliotecaApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biblioteca'] }),
  })
}

export function useDeleteExLib() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bibliotecaApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biblioteca'] }),
  })
}

export function useImportarExercicios() {
  const qc = useQueryClient()
  return useMutation<ImportarResult, Error, ExLibCreate[]>({
    mutationFn: (exercicios) => bibliotecaApi.importar(exercicios),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biblioteca'] }),
  })
}
