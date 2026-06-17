import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { personalChatApi } from '../api/personalChat'
import type { ChatMensagem } from '../types'

export function usePersonalChat(alunoId: string | null) {
  return useQuery({
    queryKey: ['personal-chat', alunoId],
    queryFn: () => personalChatApi.history(alunoId!),
    enabled: !!alunoId,
  })
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
      qc.setQueryData<ChatMensagem[]>(key, (old) => [...(old ?? []), optimistic])
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
