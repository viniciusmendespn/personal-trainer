import { api } from './client'
import { alunoClient } from './alunoClient'
import type { Cobranca, CobrancaConfig, CobrancaConfigIn, NovaCobrancaIn, RegistrarPagamentoIn, CobrancaStatus } from '../types'

export interface CobrancasResponse {
  items: Cobranca[]
  next_cursor?: string
}

export interface MercadoPagoStatus {
  configurado: boolean
  configurado_em?: string
}

// ── Painel financeiro (visão de carteira do personal) ──────────────────────────
export interface FinanceiroResumo {
  mes: string
  recebido_valor: number
  pago_count: number
  a_receber_valor: number
  pendente_count: number
  vencido_valor: number
  vencido_count: number
  mrr: number
  mp_configurado: boolean
  mp_liquido: number | null
  mp_taxa: number | null
  historico: { mes: string; recebido: number }[]
}

/** Cobrança em aberto/paga enriquecida com o nome do aluno (endpoints agregados). */
export type CobrancaComAluno = Cobranca & { aluno_nome: string }

export const financeiroPainelApi = {
  getResumo: (mes?: string) =>
    api.get<FinanceiroResumo>('/v1/financeiro/resumo', { params: mes ? { mes } : undefined }).then((r) => r.data),

  listRecebiveis: (status?: 'PENDENTE' | 'VENCIDA') =>
    api.get<{ items: CobrancaComAluno[] }>('/v1/financeiro/recebiveis', { params: status ? { status } : undefined })
      .then((r) => r.data.items),

  listPagamentosRecentes: (limit = 20) =>
    api.get<{ items: CobrancaComAluno[] }>('/v1/financeiro/pagamentos-recentes', { params: { limit } })
      .then((r) => r.data.items),
}

export const financeiroApi = {
  getConfig: (alunoId: string) =>
    api.get<CobrancaConfig>(`/v1/alunos/${alunoId}/financeiro/config`).then((r) => r.data),

  setConfig: (alunoId: string, body: CobrancaConfigIn) =>
    api.put<CobrancaConfig>(`/v1/alunos/${alunoId}/financeiro/config`, body).then((r) => r.data),

  listCobrancas: (alunoId: string, params?: { status?: CobrancaStatus; cursor?: string }) =>
    api.get<CobrancasResponse>(`/v1/alunos/${alunoId}/financeiro/cobrancas`, { params }).then((r) => r.data),

  createCobranca: (alunoId: string, body: NovaCobrancaIn) =>
    api.post<Cobranca>(`/v1/alunos/${alunoId}/financeiro/cobrancas`, body).then((r) => r.data),

  registrarPagamento: (alunoId: string, cobrancaId: string, body: RegistrarPagamentoIn) =>
    api.patch<Cobranca>(`/v1/alunos/${alunoId}/financeiro/cobrancas/${cobrancaId}/pagar`, body).then((r) => r.data),

  cancelarCobranca: (alunoId: string, cobrancaId: string) =>
    api.delete(`/v1/alunos/${alunoId}/financeiro/cobrancas/${cobrancaId}`),

  getMpConfig: () =>
    api.get<MercadoPagoStatus>('/v1/config/mercadopago').then((r) => r.data),

  setMpConfig: (accessToken: string) =>
    api.put('/v1/config/mercadopago', { access_token: accessToken }),

  deleteMpConfig: () =>
    api.delete('/v1/config/mercadopago'),
}

export interface PixResponse {
  payment_id: string
  qr_code: string
  qr_code_base64: string
  expires_at: string
}

export interface PixStatusResponse {
  payment_id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | string
  valor_liquido: number
  taxa: number
}

export const alunoFinanceiroApi = {
  listCobrancas: () =>
    alunoClient.get<CobrancasResponse>('/v1/aluno/financeiro').then((r) => r.data),

  getMpConfigurado: () =>
    alunoClient.get<{ configurado: boolean }>('/v1/aluno/financeiro/mp/configurado').then((r) => r.data),

  criarPix: (cobrancaId: string) =>
    alunoClient.post<PixResponse>(`/v1/aluno/financeiro/${cobrancaId}/pix`).then((r) => r.data),

  getPixStatus: (paymentId: string) =>
    alunoClient.get<PixStatusResponse>(`/v1/aluno/financeiro/pix/${paymentId}/status`).then((r) => r.data),
}
