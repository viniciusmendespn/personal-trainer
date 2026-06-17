import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { personalChatApi, type ChatPage } from '../api/personalChat'
import type { ChatMensagem } from '../types'

export function usePersonalChat(alunoId: string | null) {
  const query = useInfiniteQuery({
    queryKey: ['personal-chat', alunoId],
    queryFn: ({ pageParam }: { pageParam?: string }) => personalChatApi.history(alunoId!, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!alunoId,
  })
  // páginas vêm da mais recente p/ a mais antiga; inverter p/ exibir a thread em ordem cronológica
  const messages = query.data?.pages.slice().reverse().flatMap((p) => p.items)
  return { ...query, messages }
}

export function useSendPersonalChat(alunoId: string | null) {
  const qc = useQueryClient()
  const key = ['personal-chat', alunoId]
  return useMutation({
    mutationFn: (text: string) => personalChatApi.send(alunoId!, text),
    onMutate: (text: string) => {
      const optimistic: ChatMensagem = {
        mensagem_id: `optimistic-${Date.now()}`,
        aluno_id: alunoId ?? '',
        role: 'user',
        texto: text,
        ator: 'PERSONAL',
        canal_origem: 'PORTAL',
        data_hora: new Date().toISOString(),
      }
      qc.setQueryData<{ pages: ChatPage[]; pageParams: unknown[] }>(key, (old) => {
        if (!old) return old
        const [mostRecent, ...rest] = old.pages
        return { ...old, pages: [{ ...mostRecent, items: [...mostRecent.items, optimistic] }, ...rest] }
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
