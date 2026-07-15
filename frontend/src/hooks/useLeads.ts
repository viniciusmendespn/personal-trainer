import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { leadsApi, type LeadStatus } from '../api/leads'

export function useLeads(status?: string) {
  return useQuery({
    queryKey: ['leads', status ?? 'all'],
    queryFn: () => leadsApi.list(status),
  })
}

export function useSetLeadStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ref, status }: { ref: string; status: LeadStatus }) => leadsApi.setStatus(ref, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useConverterLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ref: string) => leadsApi.converter(ref),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['alunos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
