import { api } from './client'
import type { Aluno, AlunoCreate, AlunoStatus } from '../types'

export type AlunoUpdate = Partial<AlunoCreate> & { status?: AlunoStatus; foto_s3_key?: string }

export interface AlunoPage {
  items: Aluno[]
  next_cursor: string | null
}

export interface ImportarAlunosResult {
  importados: number
  pulados: number
  erros: string[]
}

export const alunosApi = {
  list: (params: { cursor?: string; limit?: number } = {}) =>
    api.get<AlunoPage>('/v1/alunos', { params }).then((r) => r.data),
  get: (id: string) => api.get<Aluno>(`/v1/alunos/${id}`).then((r) => r.data),
  create: (body: AlunoCreate) => api.post<Aluno>('/v1/alunos', body).then((r) => r.data),
  importar: (alunos: AlunoCreate[]) =>
    api.post<ImportarAlunosResult>('/v1/alunos/importar', { alunos }).then((r) => r.data),
  update: (id: string, body: AlunoUpdate) =>
    api.put<Aluno>(`/v1/alunos/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/v1/alunos/${id}`),
  enviarLink: (id: string) =>
    api.post<{ link: string; enviado: boolean }>(`/v1/alunos/${id}/enviar-link`).then((r) => r.data),
  gerarLink: (id: string) =>
    api.get<{ link: string }>(`/v1/alunos/${id}/link`).then((r) => r.data),
  novoToken: (id: string) =>
    api.post<{ link: string }>(`/v1/alunos/${id}/novo-token`).then((r) => r.data),
  avatarUploadUrl: (id: string, filename: string, contentType: string) =>
    api.post<{ upload_url: string; s3_key: string }>(`/v1/alunos/${id}/avatar/upload-url`, {
      filename, content_type: contentType,
    }).then((r) => r.data),
  syncFoto: (id: string) =>
    api.post<{ foto_url: string | null }>(`/v1/alunos/${id}/sync-foto`).then((r) => r.data),
}
