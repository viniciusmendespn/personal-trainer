import { useInfiniteQuery } from '@tanstack/react-query'
import { alunoApi } from '../api/alunoApp'

export function useAlunoTimeline() {
  const query = useInfiniteQuery({
    queryKey: ['aluno-sessoes'],
    queryFn: ({ pageParam }) => alunoApi.sessoes({ cursor: pageParam, limit: 10 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })
  return {
    ...query,
    sessions: query.data?.pages.flatMap((p) => p.items) ?? [],
  }
}
