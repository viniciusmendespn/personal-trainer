import { api } from './client'

export type PostGlobalTipo = 'ARTIGO' | 'DICA' | 'MOTIVACAO' | 'AVISO' | 'OUTRO'

export interface PostGlobalItem {
  post_id: string
  post_sk: string
  tipo: PostGlobalTipo
  texto: string
  midias: Array<{ s3_key: string; tipo: string; url?: string }>
  total_curtidas: number
  data_hora: string
}

export interface RankingPersonalItem {
  aluno_id: string
  nome: string
  total_pontos: number
  posicao: number
}

export const feedGlobalApi = {
  list: (params?: { cursor?: string; limit?: number }) =>
    api.get<{ items: PostGlobalItem[]; next_cursor: string | null }>('/v1/feed', { params }).then((r) => r.data),

  criar: (body: { tipo: PostGlobalTipo; texto: string; midias: Array<{ s3_key: string; tipo: string }> }) =>
    api.post<{ ok: number; post_id: string }>('/v1/feed', body).then((r) => r.data),

  deletar: (postId: string) => api.delete(`/v1/feed/${postId}`),

  uploadUrl: (filename: string, contentType: string) =>
    api
      .post<{ upload_url: string; s3_key: string }>('/v1/feed/midia/upload-url', {
        filename, content_type: contentType,
      })
      .then((r) => r.data),

  ranking: () =>
    api.get<RankingPersonalItem[]>('/v1/feed/ranking').then((r) => r.data),
}
