import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notifApi } from '../api/notificacoes'

export function useNotificacoes() {
  const query = useInfiniteQuery({
    queryKey: ['notificacoes'],
    queryFn: ({ pageParam }: { pageParam?: string }) => notifApi.list({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })
  return { ...query, data: query.data?.pages.flatMap((p) => p.items) }
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
