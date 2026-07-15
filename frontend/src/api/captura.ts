import axios from 'axios'

// Cliente público SEM interceptor de auth (mesmo padrão de anamnese.ts) — a página
// de captação /@slug é acessada por prospects sem login.
const publicClient = axios.create({ baseURL: import.meta.env.VITE_API_URL })

export interface CapturaPerfil {
  personal_nome: string
  personal_foto_url?: string
  descricao?: string
  biografia?: string
  instagram_url?: string
  tiktok_url?: string
  youtube_url?: string
  linkedin_url?: string
  facebook_url?: string
  x_url?: string
  site_url?: string
}

export interface LeadInput {
  nome: string
  telefone: string
  objetivo?: string
  mensagem?: string
  fonte?: string
}

export const capturaApi = {
  getPerfil: (slug: string) =>
    publicClient
      .get<CapturaPerfil>('/v1/public/captura', { params: { slug } })
      .then((r) => r.data),
  enviarLead: (slug: string, body: LeadInput) =>
    publicClient
      .post<{ ok: boolean }>('/v1/public/captura', body, { params: { slug } })
      .then((r) => r.data),
}
