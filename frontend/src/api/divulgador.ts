import { api } from './client'

// ── Tipos (espelham backend/app/services/comissao_service.py) ─────────────────

export type Faixa = 'INICIAL' | 'OFICIAL' | 'MASTER' | 'EMBAIXADOR'
export type RepasseStatus = 'PENDENTE' | 'PAGO' | null

export interface MesComissao {
  mes: string                 // YYYY-MM
  base_valor: number
  pagamentos_count: number
  vendas_novas: number
  faixa: Faixa
  pct: number                 // 0.20–0.35
  bonus: number
  comissao_valor: number
  repasse_status: RepasseStatus
  repasse_valor: number | null
  repasse_em: string | null
}

export interface PainelDivulgador {
  cupom_codigo: string
  embaixador: boolean
  fundador: boolean
  pix_key: string | null
  faixa: Faixa
  pct_base: number
  assinantes_ativos: number
  contas_total: number
  assinantes_total: number
  mes_atual: MesComissao
  acelerador: { vendas_no_mes: number; vendas_para_ativar: number; ativo: boolean }
  a_receber: number
  meses: MesComissao[]
}

export interface ClienteDivulgador {
  nome: string
  status: 'PENDENTE' | 'ASSINANTE'
  ativo: boolean
  desde: string | null
  primeiro_pgto_em: string | null
}

// ── Chamadas ──────────────────────────────────────────────────────────────────

export const divulgadorApi = {
  painel: () => api.get<PainelDivulgador>('/v1/divulgador/painel').then(r => r.data),
  clientes: () => api.get<{ clientes: ClienteDivulgador[] }>('/v1/divulgador/clientes').then(r => r.data.clientes),
}
