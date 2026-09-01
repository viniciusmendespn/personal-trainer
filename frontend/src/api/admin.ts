import { api } from './client'
import type { ClienteDivulgador, PainelDivulgador } from './divulgador'

export interface Personal {
  personal_id: string
  email: string
  name: string
  status: string
  criado_em: string | null   // ISO — UserCreateDate do Cognito (vem junto na mesma listagem)
}

export interface IndicacaoAdmin {
  personal_id: string
  name: string
  email: string
  codigo: string | null
  indicacoes_total: number
  indicacoes_convertidas: number
}

export interface DivulgadorAdmin {
  divulgador_id: string
  nome: string
  email: string
  codigo: string
  ativo: boolean
  embaixador: boolean
  fundador: boolean
  pix_key: string | null
  cupom_dias: number | null   // duração (dias) do Gestão Pro grátis que o cupom concede; null = padrão antigo (30)
  contas_total: number
  assinantes_total: number
  mes_atual: { mes: string; base_valor: number; vendas_novas: number; pct: number; comissao_valor: number }
}

export interface FeedbackAdmin {
  ref: string
  feedback_id: string
  personal_id: string
  name?: string
  email?: string
  mensagem: string
  status: 'NOVO' | 'LIDO' | 'ARQUIVADO' | 'BONIFICADO'
  criado_em: string
  dias_bonificados?: number
}

export const adminApi = {
  listPersonals: () =>
    api.get<{ personals: Personal[] }>('/v1/admin/personals').then((r) => r.data),

  listIndicacoes: () =>
    api.get<{ indicacoes: IndicacaoAdmin[] }>('/v1/admin/indicacoes').then((r) => r.data),

  impersonate: (personalId: string) =>
    api
      .post<{ token: string; expires_in: number; personal_id: string }>(
        `/v1/admin/impersonate/${personalId}`
      )
      .then((r) => r.data),

  listDivulgadores: () =>
    api.get<{ divulgadores: DivulgadorAdmin[] }>('/v1/admin/divulgadores').then((r) => r.data),

  divulgadorPainel: (divulgadorId: string) =>
    api.get<PainelDivulgador>(`/v1/admin/divulgador/${divulgadorId}/painel`).then((r) => r.data),

  divulgadorClientes: (divulgadorId: string) =>
    api.get<{ clientes: ClienteDivulgador[] }>(`/v1/admin/divulgador/${divulgadorId}/clientes`).then((r) => r.data.clientes),

  criarDivulgador: (body: { email: string; codigo: string; embaixador?: boolean; fundador?: boolean; pix_key?: string; dias?: number }) =>
    api.post('/v1/admin/divulgador', body).then((r) => r.data),

  atualizarDivulgador: (divulgadorId: string, body: { ativo?: boolean; embaixador?: boolean; fundador?: boolean; pix_key?: string; faixa_manual?: string }) =>
    api.patch(`/v1/admin/divulgador/${divulgadorId}`, body).then((r) => r.data),

  marcarRepasse: (divulgadorId: string, body: { mes: string; valor: number; obs?: string }) =>
    api.post(`/v1/admin/divulgador/${divulgadorId}/repasse`, body).then((r) => r.data),

  excluirDivulgador: (divulgadorId: string) =>
    api.delete(`/v1/admin/divulgador/${divulgadorId}`).then((r) => r.data),

  listFeedbacks: (cursor?: string) =>
    api.get<{ feedbacks: FeedbackAdmin[]; cursor: string | null }>('/v1/admin/feedbacks', {
      params: cursor ? { cursor } : undefined,
    }).then((r) => r.data),

  bonificarFeedback: (body: { personal_id: string; ref: string; dias: number }) =>
    api.post('/v1/admin/feedbacks/bonificar', body).then((r) => r.data),

  setFeedbackStatus: (body: { ref: string; status: FeedbackAdmin['status'] }) =>
    api.post('/v1/admin/feedbacks/status', body).then((r) => r.data),
}
