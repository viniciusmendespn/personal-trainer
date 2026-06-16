import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { centralApi } from '../api/central'

export function useCentral() {
  return useQuery({ queryKey: ['central'], queryFn: centralApi.get })
}

export function useVincularMidia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: centralApi.vincularMidia,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['central'] })
      qc.invalidateQueries({ queryKey: ['pendencias'] })
      qc.invalidateQueries({ queryKey: ['notif-unread'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
