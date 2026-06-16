import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notifApi } from '../api/notificacoes'

export function useNotificacoes() {
  return useQuery({ queryKey: ['notificacoes'], queryFn: notifApi.list })
}

export function useUnreadCount() {
  return useQuery({ queryKey: ['notif-unread'], queryFn: notifApi.unread, refetchInterval: 60_000 })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ref: string) => notifApi.read(ref),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificacoes'] })
      qc.invalidateQueries({ queryKey: ['notif-unread'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notifApi.readAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificacoes'] })
      qc.invalidateQueries({ queryKey: ['notif-unread'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function usePendencias() {
  return useQuery({ queryKey: ['pendencias'], queryFn: notifApi.listPendencias })
}

export function useResolvePendencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ref: string) => notifApi.resolvePendencia(ref),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pendencias'] }),
  })
}
