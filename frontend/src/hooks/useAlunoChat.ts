import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alunoChatApi, type ChatPage } from '../api/alunoChat'
import type { ChatMensagem } from '../types'

const KEY = ['aluno-chat']

export function useAlunoChat() {
  const query = useInfiniteQuery({
    queryKey: KEY,
    queryFn: ({ pageParam }: { pageParam?: string }) => alunoChatApi.history({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })
  // páginas vêm da mais recente p/ a mais antiga; inverter p/ exibir a thread em ordem cronológica
  const messages = query.data?.pages.slice().reverse().flatMap((p) => p.items)
  const agentePausado = query.data?.pages[0]?.agente_pausado ?? false
  return { ...query, messages, agentePausado }
}

function appendOptimistic(qc: ReturnType<typeof useQueryClient>, optimistic: ChatMensagem) {
  qc.setQueryData<{ pages: ChatPage[]; pageParams: unknown[] }>(KEY, (old) => {
    if (!old) return old
    const [mostRecent, ...rest] = old.pages
    return { ...old, pages: [{ ...mostRecent, items: [...mostRecent.items, optimistic] }, ...rest] }
  })
}

export function useSendAlunoChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => alunoChatApi.send(text),
    onMutate: (text: string) => {
      appendOptimistic(qc, {
        mensagem_id: `optimistic-${Date.now()}`,
        aluno_id: '',
        role: 'user',
        texto: text,
        ator: 'ALUNO',
        canal_origem: 'PORTAL',
        data_hora: new Date().toISOString(),
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSendDiretoAlunoChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => alunoChatApi.sendDireto(text),
    onMutate: (text: string) => {
      appendOptimistic(qc, {
        mensagem_id: `optimistic-${Date.now()}`,
        aluno_id: '',
        role: 'user',
        texto: text,
        ator: 'ALUNO',
        canal_origem: 'PORTAL',
        data_hora: new Date().toISOString(),
        direto: true,
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
