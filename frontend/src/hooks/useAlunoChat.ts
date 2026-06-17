import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alunoChatApi } from '../api/alunoChat'

const KEY = ['aluno-chat']

export function useAlunoChat() {
  return useQuery({ queryKey: KEY, queryFn: () => alunoChatApi.history() })
}

export function useSendAlunoChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => alunoChatApi.send(text),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
