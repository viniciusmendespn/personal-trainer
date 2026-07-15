import { api } from './client'
import type { LeadStatus } from '../types'

export type { LeadStatus }

export interface Lead {
  ref: string
  lead_id: string
  nome: string
  telefone: string
  objetivo?: string
  mensagem?: string
  fonte: string
  status: LeadStatus
  created_at: string
  updated_at?: string
}

export interface LeadsResponse {
  items: Lead[]
  por_fonte: Record<string, number>
  por_status: Record<string, number>
}

export const leadsApi = {
  list: (status?: string) =>
    api.get<LeadsResponse>('/v1/leads', { params: status ? { status } : {} }).then((r) => r.data),
  setStatus: (ref: string, status: LeadStatus) =>
    api.patch<{ status: LeadStatus }>('/v1/leads/status', { ref, status }).then((r) => r.data),
  converter: (ref: string) =>
    api.post<{ aluno_id: string; ja_existia: boolean }>('/v1/leads/converter', { ref }).then((r) => r.data),
}
