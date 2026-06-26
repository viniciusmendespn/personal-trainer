import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cupomApi } from '../api/cupom'
import { PLANO_KEY } from './usePlano'

export const CUPOM_KEY = ['cupom']

export function useCupomIndicacao() {
  return useQuery({ queryKey: CUPOM_KEY, queryFn: cupomApi.getIndicacao, staleTime: 60_000 })
}

export function useResgatarCupom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (codigo: string) => cupomApi.resgatar(codigo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANO_KEY })
      qc.invalidateQueries({ queryKey: ['plano', 'pagamentos'] })
      qc.invalidateQueries({ queryKey: CUPOM_KEY })
    },
  })
}
