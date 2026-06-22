import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { planoApi } from '../api/plano'

const KEY = ['plano']

export function usePlanoStatus() {
  return useQuery({ queryKey: KEY, queryFn: planoApi.getStatus, staleTime: 30_000 })
}

export function usePlanoCatalogo() {
  return useQuery({ queryKey: ['plano', 'catalogo'], queryFn: planoApi.getCatalogo, staleTime: 5 * 60_000 })
}

export function useCriarPix() {
  return useMutation({ mutationFn: planoApi.criarPix })
}

export function usePixStatus(paymentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['plano', 'pix', paymentId],
    queryFn: () => planoApi.getPixStatus(paymentId as string),
    enabled: enabled && !!paymentId,
    refetchInterval: 4_000,
  })
}

export function useInvalidatePlano() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: KEY })
}
