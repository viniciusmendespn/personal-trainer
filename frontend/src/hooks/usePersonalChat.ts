import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { personalChatApi } from '../api/personalChat'

export function usePersonalChat(alunoId: string | null) {
  return useQuery({
    queryKey: ['personal-chat', alunoId],
    queryFn: () => personalChatApi.history(alunoId!),
    enabled: !!alunoId,
  })
}

export function useSendPersonalChat(alunoId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => personalChatApi.send(alunoId!, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-chat', alunoId] }),
  })
}
