import { useEffect } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alunosApi, type AlunoUpdate } from '../api/alunos'
import type { AlunoCreate } from '../types'
import { PLANO_KEY } from './usePlano'

const KEY = ['alunos']
const KEY_PAGE = ['alunos', 'page']

function useAlunosInfinite(key: unknown[]) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }: { pageParam?: string }) => alunosApi.list({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })
}

/** Roster completo do personal — carrega todas as páginas em segundo plano. Usar em
 * seletores/pickers que precisam de todos os alunos (Agenda, Templates, Pendências, Chat). */
export function useAlunos() {
  const query = useAlunosInfinite(KEY)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  return { ...query, data: query.data?.pages.flatMap((p) => p.items) }
}

/** Lista paginada (1 página por vez) p/ a tela de Alunos, com "carregar mais". */
export function useAlunosPaginated() {
  const query = useAlunosInfinite(KEY_PAGE)
  return { ...query, data: query.data?.pages.flatMap((p) => p.items) }
}

export function useAluno(id: string) {
  return useQuery({ queryKey: ['aluno', id], queryFn: () => alunosApi.get(id), enabled: !!id })
}

export function useCreateAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AlunoCreate) => alunosApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: KEY_PAGE })
      qc.invalidateQueries({ queryKey: PLANO_KEY })
    },
  })
}

export function useUpdateAluno(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AlunoUpdate) => alunosApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: KEY_PAGE })
      qc.invalidateQueries({ queryKey: ['aluno', id] })
      qc.invalidateQueries({ queryKey: PLANO_KEY })
    },
  })
}

export function useDeleteAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => alunosApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: KEY_PAGE })
      qc.invalidateQueries({ queryKey: PLANO_KEY })
    },
  })
}
