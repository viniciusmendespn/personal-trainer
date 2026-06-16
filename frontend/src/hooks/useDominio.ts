import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { avaliacoesApi, type AvaliacaoCreate } from '../api/avaliacoes'
import { bibliotecaApi, type ExLibCreate } from '../api/biblioteca'

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

export function useDeleteExLib() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bibliotecaApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biblioteca'] }),
  })
}
