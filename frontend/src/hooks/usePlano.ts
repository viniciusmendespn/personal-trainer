import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { planoApi } from '../api/plano'

export const PLANO_KEY = ['plano']
const KEY = PLANO_KEY

export function usePlanoStatus() {
  return useQuery({ queryKey: KEY, queryFn: planoApi.getStatus, staleTime: 30_000 })
}

export function usePlanoCatalogo() {
  return useQuery({ queryKey: ['plano', 'catalogo'], queryFn: planoApi.getCatalogo, staleTime: 5 * 60_000 })
}

export function useCriarPix() {
  return useMutation({ mutationFn: planoApi.criarPix })
}

const PIX_TERMINAL_STATUSES = ['approved', 'rejected', 'cancelled']

export function usePixStatus(paymentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['plano', 'pix', paymentId],
    queryFn: () => planoApi.getPixStatus(paymentId as string),
    enabled: enabled && !!paymentId,
    refetchInterval: (query) => (PIX_TERMINAL_STATUSES.includes(query.state.data?.status ?? '') ? false : 4_000),
  })
}

export function useInvalidatePlano() {
  const qc = useQueryClient()
  return useCallback(() => qc.invalidateQueries({ queryKey: KEY }), [qc])
}
