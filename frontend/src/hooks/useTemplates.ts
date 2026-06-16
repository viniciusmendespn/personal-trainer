import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { templatesApi } from '../api/templates'
import type { TreinoTemplateCreate } from '../types'

const KEY = ['templates']

export function useTemplates() {
  return useQuery({ queryKey: KEY, queryFn: templatesApi.list })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TreinoTemplateCreate) => templatesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useCreateTemplateFromTreino() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ alunoId, treinoId, nome }: { alunoId: string; treinoId: string; nome?: string }) =>
      templatesApi.createFromTreino(alunoId, treinoId, nome),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => templatesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useAplicarTemplate() {
  return useMutation({
    mutationFn: ({ id, alunoIds }: { id: string; alunoIds: string[] }) => templatesApi.aplicar(id, alunoIds),
  })
}
