import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notasApi } from '../api/notas'

export function useNotas(alunoId: string) {
  const query = useInfiniteQuery({
    queryKey: ['notas', alunoId],
    queryFn: ({ pageParam }: { pageParam?: string }) => notasApi.list(alunoId, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!alunoId,
  })
  return { ...query, data: query.data?.pages.flatMap((p) => p.items) }
}

export function useCreateNota(alunoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (texto: string) => notasApi.create(alunoId, texto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas', alunoId] }),
  })
}
