import { api } from './client'
import type { Avaliacao, Custom, MetricaCustomizada } from '../types'

export interface AvaliacaoCreate {
  data?: string
  peso?: number
  altura_cm?: number
  percentual_gordura?: number
  medidas?: Custom
  metricas?: MetricaCustomizada[]
  observacoes?: string
  fotos_s3_keys?: string[]
  bio_scan_s3_key?: string
}

export const avaliacoesApi = {
  list: (alunoId: string) =>
    api.get<Avaliacao[]>(`/v1/alunos/${alunoId}/avaliacoes`).then((r) => r.data),
  create: (alunoId: string, body: AvaliacaoCreate) =>
    api.post<Avaliacao>(`/v1/alunos/${alunoId}/avaliacoes`, body).then((r) => r.data),
  remove: (alunoId: string, tsId: string) =>
    api.delete(`/v1/alunos/${alunoId}/avaliacoes/${tsId}`),
  getUploadUrl: (alunoId: string, filename: string, contentType: string) =>
    api.post<{ upload_url: string; s3_key: string }>(`/v1/alunos/${alunoId}/avaliacoes/upload-url`, {
      filename, content_type: contentType,
    }).then((r) => r.data),
}

/** Pede a presigned URL e sobe o arquivo direto pro S3 (sem passar pela Lambda). */
export async function uploadAvaliacaoFile(alunoId: string, file: File): Promise<string> {
  const { upload_url, s3_key } = await avaliacoesApi.getUploadUrl(alunoId, file.name, file.type)
  await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  return s3_key
}
