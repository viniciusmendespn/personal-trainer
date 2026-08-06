import { api } from './client'

export interface PersonalProfile {
  personal_id?: string
  nome?: string
  descricao?: string
  biografia?: string
  experiencia_profissional?: string
  formacao?: string
  foto_s3_key?: string
  foto_url?: string
  instagram_url?: string
  tiktok_url?: string
  youtube_url?: string
  linkedin_url?: string
  facebook_url?: string
  x_url?: string
  site_url?: string
  slug?: string
  /** Avisar quando um aluno concluir um treino pelo app. Ausente = ligado. */
  notif_treino_concluido?: boolean
  updated_at?: string
}

export const personalApi = {
  getProfile: () => api.get<PersonalProfile>('/v1/personal/me').then((r) => r.data),
  updateProfile: (body: Omit<PersonalProfile, 'personal_id' | 'foto_url' | 'updated_at' | 'slug'>) =>
    api.put<PersonalProfile>('/v1/personal/me', body).then((r) => r.data),
  avatarUploadUrl: (filename: string, contentType: string) =>
    api.post<{ upload_url: string; s3_key: string }>('/v1/personal/me/avatar/upload-url', {
      filename, content_type: contentType,
    }).then((r) => r.data),
  setSlug: (slug: string) =>
    api.post<{ slug: string }>('/v1/personal/me/slug', { slug }).then((r) => r.data),
}
