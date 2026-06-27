import { api } from './client'
import type { Rotina, RotinaCreate, AplicarRotinaModo } from '../types'

export const rotinasApi = {
  list: () => api.get<Rotina[]>('/v1/rotinas').then((r) => r.data),
  create: (body: RotinaCreate) => api.post<Rotina>('/v1/rotinas', body).then((r) => r.data),
  fromAluno: (alunoId: string, nome?: string, salvarTemplates = true) =>
    api.post<{ rotina: Rotina; templates_criados: number }>('/v1/rotinas/from-aluno', {
      aluno_id: alunoId, nome, salvar_templates: salvarTemplates,
    }).then((r) => r.data),
  fromTemplates: (nome: string, templateIds: string[], descricao?: string) =>
    api.post<Rotina>('/v1/rotinas/from-templates', {
      nome, descricao, template_ids: templateIds,
    }).then((r) => r.data),
  get: (id: string) => api.get<Rotina>(`/v1/rotinas/${id}`).then((r) => r.data),
  update: (id: string, body: RotinaCreate) =>
    api.put<Rotina>(`/v1/rotinas/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/v1/rotinas/${id}`),
  aplicar: (id: string, alunoIds: string[], modo: AplicarRotinaModo) =>
    api.post<{ aplicados: { aluno_id: string; treinos: string[] }[] }>(`/v1/rotinas/${id}/aplicar`, {
      aluno_ids: alunoIds, modo,
    }).then((r) => r.data),
}
