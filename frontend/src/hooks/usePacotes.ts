import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pacotesApi } from '../api/pacotes'
import type { GerarPacoteBody } from '../api/pacotes'

const KEY = ['pacotes']

export function usePacotes() {
  return useQuery({ queryKey: KEY, queryFn: pacotesApi.list })
}

export function useImportarPacote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conteudo: string) => pacotesApi.importar(conteudo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['biblioteca'] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['rotinas'] })
    },
  })
}

export function useTogglePacote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pacoteId, ativo }: { pacoteId: string; ativo: boolean }) =>
      pacotesApi.togglePacote(pacoteId, ativo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['biblioteca'] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['rotinas'] })
    },
  })
}

export function useToggleItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pacoteId, itemId, ativo }: { pacoteId: string; itemId: string; ativo: boolean }) =>
      pacotesApi.toggleItem(pacoteId, itemId, ativo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['biblioteca'] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['rotinas'] })
    },
  })
}

export function useImportarRascunho() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conteudo: string) => pacotesApi.importarRascunho(conteudo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['biblioteca'] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['rotinas'] })
    },
  })
}

export function useRemoverPacote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pacoteId: string) => pacotesApi.remover(pacoteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['biblioteca'] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['rotinas'] })
    },
  })
}

export function useExportarPacote() {
  return useMutation({
    mutationFn: (pacoteId: string) => pacotesApi.exportar(pacoteId),
  })
}

export function useGerarPacote() {
  return useMutation({
    mutationFn: (body: GerarPacoteBody) => pacotesApi.gerar(body),
  })
}
