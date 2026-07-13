import { api } from './client'
import { alunoClient } from './alunoClient'

export interface Ferias {
  ferias_id: string
  ts: string
  aluno_id: string
  personal_id: string
  data_inicio: string          // YYYY-MM-DD
  data_fim: string             // YYYY-MM-DD
  observacao?: string
  criado_por: 'PERSONAL' | 'ALUNO'
  created_at: string
}

export interface FeriasCreate {
  data_inicio: string
  data_fim: string
  observacao?: string
}

/** SK composto usado nas rotas de update/delete (igual ao padrão de Metas). */
export const feriasTsId = (f: Pick<Ferias, 'ts' | 'ferias_id'>) => `${f.ts}#${f.ferias_id}`

// ── Portal (personal) ────────────────────────────────────────────────────────
export const feriasApi = {
  list: (alunoId: string) =>
    api.get<Ferias[]>(`/v1/alunos/${alunoId}/ferias`).then((r) => r.data),
  create: (alunoId: string, body: FeriasCreate) =>
    api.post<Ferias>(`/v1/alunos/${alunoId}/ferias`, body).then((r) => r.data),
  update: (alunoId: string, tsId: string, body: Partial<FeriasCreate>) =>
    api.put<Ferias>(`/v1/alunos/${alunoId}/ferias/${encodeURIComponent(tsId)}`, body).then((r) => r.data),
  remove: (alunoId: string, tsId: string) =>
    api.delete(`/v1/alunos/${alunoId}/ferias/${encodeURIComponent(tsId)}`),
}

// ── App do aluno ──────────────────────────────────────────────────────────────
export const alunoFeriasApi = {
  list: () => alunoClient.get<Ferias[]>('/v1/aluno/ferias').then((r) => r.data),
  create: (body: FeriasCreate) => alunoClient.post<Ferias>('/v1/aluno/ferias', body).then((r) => r.data),
  remove: (tsId: string) => alunoClient.delete(`/v1/aluno/ferias/${encodeURIComponent(tsId)}`),
}
