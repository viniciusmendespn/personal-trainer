import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alertasApi } from '../api/alertas'

export function useAlertas() {
  return useQuery({ queryKey: ['alertas'], queryFn: alertasApi.list })
}

export function useResolveAlerta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ref: string) => alertasApi.resolve(ref),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertas'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function usePendencias() {
  return useQuery({ queryKey: ['pendencias'], queryFn: alertasApi.listPendencias })
}

export function useResolvePendencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ref: string) => alertasApi.resolvePendencia(ref),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pendencias'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
