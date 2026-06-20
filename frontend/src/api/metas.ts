import { api } from './client'
import { alunoClient } from './alunoClient'

export type MetaTipo = 'CARGA' | 'PESO' | 'MEDIDA' | 'LIVRE'
export type MetaStatus = 'PENDENTE' | 'APROVADA' | 'CONCLUIDA' | 'CANCELADA'

export interface Meta {
  meta_id: string
  ts_id: string
  aluno_id: string
  personal_id: string
  tipo: MetaTipo
  titulo: string
  descricao?: string
  valor_alvo: number
  unidade: string
  exercicio_id?: string
  campo_medida?: string
  data_limite?: string
  status: MetaStatus
  criado_por: 'PERSONAL' | 'ALUNO'
  created_at: string
  data_conclusao?: string
  valor_atingido?: number
}

export interface MetaCreate {
  tipo: MetaTipo
  titulo: string
  descricao?: string
  valor_alvo: number
  unidade: string
  exercicio_id?: string
  campo_medida?: string
  data_limite?: string
}

export const metasApi = {
  list: (alunoId: string, status?: MetaStatus) =>
    api.get<Meta[]>(`/v1/alunos/${alunoId}/metas`, { params: status ? { status } : undefined }).then((r) => r.data),
  create: (alunoId: string, body: MetaCreate) =>
    api.post<Meta>(`/v1/alunos/${alunoId}/metas`, body).then((r) => r.data),
  update: (alunoId: string, tsId: string, body: Partial<MetaCreate>) =>
    api.put<Meta>(`/v1/alunos/${alunoId}/metas/${encodeURIComponent(tsId)}`, body).then((r) => r.data),
  alterarStatus: (alunoId: string, tsId: string, status: MetaStatus) =>
    api.patch<Meta>(`/v1/alunos/${alunoId}/metas/${encodeURIComponent(tsId)}/status`, { status }).then((r) => r.data),
  remove: (alunoId: string, tsId: string) =>
    api.delete(`/v1/alunos/${alunoId}/metas/${encodeURIComponent(tsId)}`),
}

export const alunoMetasApi = {
  list: () => alunoClient.get<Meta[]>('/v1/aluno/metas').then((r) => r.data),
  create: (body: MetaCreate) => alunoClient.post<Meta>('/v1/aluno/metas', body).then((r) => r.data),
}
