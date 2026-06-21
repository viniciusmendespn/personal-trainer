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

export const financeiroApi = {
  getConfig: (alunoId: string) =>
    api.get<CobrancaConfig>(`/v1/alunos/${alunoId}/financeiro/config`).then((r) => r.data),

  setConfig: (alunoId: string, body: CobrancaConfigIn) =>
    api.put<CobrancaConfig>(`/v1/alunos/${alunoId}/financeiro/config`, body).then((r) => r.data),

  listCobranças: (alunoId: string, params?: { status?: CobrancaStatus; cursor?: string }) =>
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

export const alunoFinanceiroApi = {
  listCobranças: () =>
    alunoClient.get<CobrancasResponse>('/v1/aluno/financeiro').then((r) => r.data),
}
