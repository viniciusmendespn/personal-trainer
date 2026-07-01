import { useInfiniteQuery } from '@tanstack/react-query'
import { treinosApi } from '../api/treinos'

/** Timeline paginada das sessões de um aluno, na visão do personal (portal).
 * Espelha useAlunoTimeline, mas parametrizado por alunoId. */
export function usePersonalTimeline(alunoId: string) {
  const query = useInfiniteQuery({
    queryKey: ['personal-sessoes', alunoId],
    queryFn: ({ pageParam }) => treinosApi.listSessoes(alunoId, { cursor: pageParam, limit: 10 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })
  return {
    ...query,
    sessions: query.data?.pages.flatMap((p) => p.items) ?? [],
  }
}
