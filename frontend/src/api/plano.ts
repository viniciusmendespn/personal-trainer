import { api } from './client'
import type { AssinaturaStatus, PagamentoAssinatura, PlanoCatalogoItem } from '../types'

export interface PixPayment {
  payment_id: string
  qr_code: string
  qr_code_base64: string
  expires_at: string
}

export interface PixStatus {
  payment_id: string
  status: string
}

export const planoApi = {
  getStatus: () => api.get<AssinaturaStatus>('/v1/plano').then((r) => r.data),
  getCatalogo: () => api.get<Record<string, PlanoCatalogoItem>>('/v1/plano/catalogo').then((r) => r.data),
  criarPix: (periodo: 'mensal' | 'anual' = 'mensal') => api.post<PixPayment>('/v1/plano/pix', { periodo }).then((r) => r.data),
  getPixStatus: (paymentId: string) => api.get<PixStatus>(`/v1/plano/pix/${paymentId}`).then((r) => r.data),
  getPagamentos: () => api.get<PagamentoAssinatura[]>('/v1/plano/pagamentos').then((r) => r.data),
}
