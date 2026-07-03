import { useQuery } from '@tanstack/react-query'
import { financeiroPainelApi } from '../api/financeiro'

/** Resumo agregado (KPIs) do painel financeiro do personal. */
export function useFinanceiroResumo(mes?: string) {
  return useQuery({
    queryKey: ['financeiro-resumo', mes ?? 'atual'],
    queryFn: () => financeiroPainelApi.getResumo(mes),
    staleTime: 60_000,
  })
}

/** Cobranças em aberto (pendentes/vencidas) de toda a carteira. */
export function useRecebiveis(status?: 'PENDENTE' | 'VENCIDA') {
  return useQuery({
    queryKey: ['financeiro-recebiveis', status ?? 'todos'],
    queryFn: () => financeiroPainelApi.listRecebiveis(status),
    staleTime: 60_000,
  })
}

/** Últimos pagamentos confirmados da carteira. */
export function usePagamentosRecentes(limit = 20) {
  return useQuery({
    queryKey: ['financeiro-pagamentos', limit],
    queryFn: () => financeiroPainelApi.listPagamentosRecentes(limit),
    staleTime: 60_000,
  })
}
