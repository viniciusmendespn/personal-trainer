import { api } from './client'
import type { AssinaturaStatus, CupomIndicacao } from '../types'

export interface ResgateResult extends AssinaturaStatus {
  cupom: { campanha: string; dias: number }
}

export const cupomApi = {
  getIndicacao: () => api.get<CupomIndicacao>('/v1/cupom/indicacao').then((r) => r.data),
  resgatar: (codigo: string) =>
    api.post<ResgateResult>('/v1/cupom/resgatar', { codigo }).then((r) => r.data),
}
