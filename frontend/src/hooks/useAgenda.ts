import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agendaApi } from '../api/agenda'
import type { Agendamento, AgendamentoCreate, AgendamentoStatus } from '../types'

export function useAgenda(de: string, ate: string) {
  return useQuery({
    queryKey: ['agenda', de, ate],
    queryFn: () => agendaApi.list(de, ate),
    enabled: !!de && !!ate,
  })
}

export function useCreateAgendamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AgendamentoCreate) => agendaApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  })
}

export function useUpdateAgendamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ a, body }: { a: Agendamento; body: Partial<AgendamentoCreate> }) => agendaApi.update(a, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  })
}

export function useSetAgendamentoStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ a, status }: { a: Agendamento; status: AgendamentoStatus }) => agendaApi.setStatus(a, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  })
}

export function useDeleteAgendamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: Agendamento) => agendaApi.remove(a),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  })
}
