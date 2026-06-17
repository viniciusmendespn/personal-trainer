import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alunoChatApi } from '../api/alunoChat'
import type { ChatMensagem } from '../types'

const KEY = ['aluno-chat']

export function useAlunoChat() {
  return useQuery({ queryKey: KEY, queryFn: () => alunoChatApi.history() })
}

export function useSendAlunoChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => alunoChatApi.send(text),
    onMutate: (text: string) => {
      const optimistic: ChatMensagem = {
        mensagem_id: `optimistic-${Date.now()}`,
        aluno_id: '',
        role: 'user',
        texto: text,
        ator: 'ALUNO',
        canal_origem: 'PORTAL',
        data_hora: new Date().toISOString(),
      }
      qc.setQueryData<ChatMensagem[]>(KEY, (old) => [...(old ?? []), optimistic])
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSendDiretoAlunoChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => alunoChatApi.sendDireto(text),
    onMutate: (text: string) => {
      const optimistic: ChatMensagem = {
        mensagem_id: `optimistic-${Date.now()}`,
        aluno_id: '',
        role: 'user',
        texto: text,
        ator: 'ALUNO',
        canal_origem: 'PORTAL',
        data_hora: new Date().toISOString(),
        direto: true,
      }
      qc.setQueryData<ChatMensagem[]>(KEY, (old) => [...(old ?? []), optimistic])
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
