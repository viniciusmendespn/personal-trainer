import { api } from './client'
import axios from 'axios'

export interface PerguntaAnamnese {
  key: string
  label: string
  type: 'TEXT' | 'NUMBER' | 'BOOL' | 'SELECT' | 'DATE'
  options?: string[]
  required: boolean
  placeholder?: string
}

export interface AnamneseTemplate {
  perguntas: PerguntaAnamnese[]
  mensagem_boas_vindas: string
  solicitar_email: boolean
  solicitar_nascimento: boolean
  solicitar_objetivo: boolean
}

export interface AnamneseResposta {
  respostas: Record<string, unknown>
  preenchido_em?: string
  preenchido_por: string
}

const publicClient = axios.create({ baseURL: import.meta.env.VITE_API_URL })

export const anamneseApi = {
  getTemplate: () =>
    api.get<AnamneseTemplate>('/v1/anamnese/template').then((r) => r.data),
  saveTemplate: (body: AnamneseTemplate) =>
    api.put<AnamneseTemplate>('/v1/anamnese/template', body).then((r) => r.data),
  gerarLink: () =>
    api.post<{ url: string }>('/v1/anamnese/cadastro-link').then((r) => r.data),
  getAlunoAnamnese: (alunoId: string) =>
    api.get<AnamneseResposta | null>(`/v1/alunos/${alunoId}/anamnese`).then((r) => r.data),
  updateAlunoAnamnese: (alunoId: string, body: Partial<AnamneseResposta>) =>
    api.put<AnamneseResposta>(`/v1/alunos/${alunoId}/anamnese`, body).then((r) => r.data),
  getFormPublico: (token: string) =>
    publicClient.get<{ template: AnamneseTemplate; personal_nome: string; personal_foto_url?: string }>(
      '/v1/public/anamnese', { params: { token } }
    ).then((r) => r.data),
  cadastrar: (token: string, body: {
    nome: string; telefone: string; email?: string
    data_nascimento?: string; objetivo?: string; respostas?: Record<string, unknown>
  }) =>
    publicClient.post<{ magic_link: string; aluno_id: string }>(
      '/v1/public/anamnese', body, { params: { token } }
    ).then((r) => r.data),
}
