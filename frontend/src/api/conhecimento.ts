import { api } from './client'
import type { ArquivoConhecimento } from '../types'

export const conhecimentoApi = {
  list: () => api.get<ArquivoConhecimento[]>('/v1/conhecimento').then((r) => r.data),
  getUploadUrl: (filename: string, contentType: string) =>
    api.post<{ upload_url: string; s3_key: string }>('/v1/conhecimento/upload-url', {
      filename, content_type: contentType,
    }).then((r) => r.data),
  registrar: (body: { filename: string; content_type: string; size_bytes: number; s3_key: string; descricao?: string }) =>
    api.post<{ ok: number; arquivo_id: string }>('/v1/conhecimento', body).then((r) => r.data),
  remove: (arquivoId: string) => api.delete(`/v1/conhecimento/${arquivoId}`),
  getDownloadUrl: () => api.get<{ download_url: string }>('/v1/conhecimento/download').then((r) => r.data),
}

/** Pede a presigned URL e sobe o arquivo direto pro S3, depois registra no backend. */
export async function uploadConhecimentoArquivo(file: File): Promise<string> {
  const { upload_url, s3_key } = await conhecimentoApi.getUploadUrl(file.name, file.type)
  const putResp = await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  if (!putResp.ok) throw new Error(`Falha ao enviar "${file.name}" para o armazenamento.`)
  const { arquivo_id } = await conhecimentoApi.registrar({
    filename: file.name, content_type: file.type, size_bytes: file.size, s3_key,
  })
  return arquivo_id
}
