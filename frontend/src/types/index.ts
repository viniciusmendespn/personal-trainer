// Espelho dos enums/modelos do backend (app/models). Manter em sincronia.

export type AlunoStatus = 'ATIVO' | 'INATIVO'
export type CustomFieldType = 'TEXT' | 'NUMBER' | 'BOOL' | 'SELECT' | 'DATE'

export interface Custom {
  [key: string]: unknown
}

export interface Aluno {
  aluno_id: string
  personal_id: string
  nome: string
  telefone: string
  status: AlunoStatus
  email?: string
  endereco?: string
  data_nascimento?: string
  objetivo?: string
  observacoes?: string
  descricao?: string
  foto_s3_key?: string
  foto_url?: string
  custom?: Custom
  agente_habilitado?: boolean
  bloqueado?: boolean
  created_at: string
  updated_at: string
}

export interface AlunoExistenteConflict {
  code: 'PHONE_ALREADY_REGISTERED'
  message: string
  aluno_existente: { aluno_id: string; nome: string; status: AlunoStatus } | null
}

export type PlanoTipo = 'TRIAL' | 'GESTAO_PRO'
export type AssinaturaStatusTipo = 'TRIAL' | 'ATIVO' | 'EXPIRADO'

export interface AssinaturaStatus {
  plano: PlanoTipo
  status: AssinaturaStatusTipo
  trial_iniciado_em: string
  valida_ate?: string | null
  dias_restantes?: number | null
  alunos_limit: number | null
  alunos_count: number
  addon_whatsapp_ativo: boolean
  addon_ia_ativo: boolean
}

export interface PagamentoAssinatura {
  payment_id: string | null
  origem: 'PIX' | 'ADMIN' | 'PROMO' | 'INDICACAO'
  valor: number | null
  dias_concedidos: number
  plano: PlanoTipo
  valida_ate: string
  processado_em: string
  finpilot_code?: string | null
}

export interface CupomIndicacao {
  codigo: string
  indicacoes_total: number
  indicacoes_convertidas: number
  meses_ganhos: number
  criado_em?: string
}

export interface PlanoCatalogoItem {
  nome: string
  preco: string
  alunos_limit: number | null
}

export interface PlanoLimitConflict {
  code: 'PLAN_ALUNO_LIMIT_EXCEEDED'
  limit: number
  current: number
  plano: PlanoTipo
}

export interface AddonRequiredConflict {
  code: 'ADDON_REQUIRED'
  addon: 'whatsapp' | 'ia'
}

export interface AlunoCreate {
  nome: string
  telefone: string
  email?: string
  endereco?: string
  data_nascimento?: string
  objetivo?: string
  observacoes?: string
  descricao?: string
  custom?: Custom
}

export interface Treino {
  treino_id: string
  aluno_id: string
  nome: string
  ordem: number
  foco?: string
  observacoes?: string
  ativo: boolean
  data_inicio?: string
  data_fim?: string
  custom?: Custom
  created_at: string
  updated_at: string
}

export interface TreinoCreate {
  nome: string
  ordem?: number
  foco?: string
  observacoes?: string
  ativo?: boolean
  data_inicio?: string
  data_fim?: string
  custom?: Custom
}

export interface MetricaCustomizada {
  nome: string
  unidade: string
  valor: number
}

export interface Avaliacao {
  avaliacao_id: string
  aluno_id: string
  ts_id?: string
  data?: string
  peso?: number
  altura_cm?: number
  percentual_gordura?: number
  medidas?: Custom
  metricas?: MetricaCustomizada[]
  observacoes?: string
  fotos_s3_keys?: string[]
  bio_scan_s3_key?: string
  fotos_urls?: string[]
  bio_scan_url?: string
  created_at: string
}

export interface ExercicioSubstituto {
  nome: string
  video_url?: string
  observacao?: string
  series_prescritas?: SeriePrescrita[]
}

export interface ExLib {
  exlib_id: string
  nome: string
  grupo?: string
  video_url?: string
  descricao?: string
  recomendacoes?: string
  links_uteis?: string[]
  substitutos?: ExercicioSubstituto[]
}

export interface ArquivoConhecimento {
  arquivo_id: string
  filename: string
  content_type: string
  size_bytes: number
  descricao?: string
  uploaded_at: string
}

export type TipoExercicio = 'FORCA' | 'CARDIO' | 'PESO_CORPORAL'

export interface SeriePrescrita {
  series: number
  reps: string
  carga?: string
}

export interface Exercicio {
  exercicio_id: string
  treino_id: string
  aluno_id: string
  nome: string
  grupo?: string
  ordem: number
  tipo_exercicio?: TipoExercicio
  unidade_carga?: string
  unidade_reps?: string
  series?: number
  reps_prescritas?: string
  carga_prescrita?: string
  series_prescritas?: SeriePrescrita[]
  intervalo_s?: number
  video_url?: string
  observacoes?: string
  rm_kg?: number
  links_uteis?: string[]
  links_uteis_excluidos?: string[]
  substitutos?: ExercicioSubstituto[]
  substitutos_excluidos?: string[]
  substitutos_efetivos?: ExercicioSubstituto[]
  custom?: Custom
}

export interface ExercicioCreate {
  nome: string
  grupo?: string
  ordem?: number
  tipo_exercicio?: TipoExercicio
  unidade_carga?: string
  unidade_reps?: string
  series?: number
  reps_prescritas?: string
  carga_prescrita?: string
  series_prescritas?: SeriePrescrita[]
  intervalo_s?: number
  video_url?: string
  observacoes?: string
  rm_kg?: number
  links_uteis?: string[]
  links_uteis_excluidos?: string[]
  substitutos?: ExercicioSubstituto[]
  substitutos_excluidos?: string[]
  custom?: Custom
}

export interface CustomFieldDef {
  key: string
  label: string
  type: CustomFieldType
  options?: string[]
  required: boolean
}

export interface CustomFieldsConfig {
  aluno: CustomFieldDef[]
  treino: CustomFieldDef[]
  exercicio: CustomFieldDef[]
}

export interface WapiStatus {
  configured: boolean
  status: 'CONNECTED' | 'DISCONNECTED'
  connected: boolean
  phone?: string
}

export interface WapiDeviceInfo {
  phone: string
  photo_url: string | null
}

export type AgendamentoStatus = 'AGENDADO' | 'CONFIRMADO' | 'CANCELADO' | 'CONCLUIDO'

export interface Agendamento {
  agendamento_id: string
  personal_id: string
  aluno_id: string
  data_hora_inicio: string
  duracao_min: number
  observacao?: string
  status: AgendamentoStatus
  created_at: string
}

export interface AgendamentoCreate {
  aluno_id: string
  data_hora_inicio: string
  duracao_min?: number
  observacao?: string
}

export interface ExercicioTemplate {
  nome: string
  ordem?: number
  tipo_exercicio?: TipoExercicio
  grupo?: string
  rm_kg?: number
  unidade_carga?: string
  unidade_reps?: string
  series?: number
  reps_prescritas?: string
  carga_prescrita?: string
  series_prescritas?: SeriePrescrita[]
  intervalo_s?: number
  video_url?: string
  observacoes?: string
  links_uteis?: string[]
  links_uteis_excluidos?: string[]
  substitutos?: ExercicioSubstituto[]
  substitutos_excluidos?: string[]
}

export interface TreinoTemplate {
  template_id: string
  personal_id: string
  nome: string
  foco?: string
  exercicios: ExercicioTemplate[]
  created_at: string
}

export interface TreinoTemplateCreate {
  nome: string
  foco?: string
  exercicios?: ExercicioTemplate[]
}

export interface TreinoRotina {
  nome: string
  foco?: string
  ordem?: number
  exercicios: ExercicioTemplate[]
}

export interface Rotina {
  rotina_id: string
  personal_id: string
  nome: string
  descricao?: string
  treinos: TreinoRotina[]
  created_at: string
}

export interface RotinaCreate {
  nome: string
  descricao?: string
  treinos: TreinoRotina[]
}

export type AplicarRotinaModo = 'adicionar' | 'substituir'

export type CanalOrigem = 'WHATSAPP' | 'PORTAL'
export type Ator = 'ALUNO' | 'PERSONAL'

// ── Financeiro ────────────────────────────────────────────────────────────────
export type CobrancaStatus = 'PENDENTE' | 'PAGA' | 'VENCIDA'
export type Recorrencia = 'MENSAL' | 'ANUAL'
export type FormaPagamento = 'MANUAL' | 'PIX_MP'

export interface CobrancaConfig {
  aluno_id: string
  personal_id: string
  valor: number
  recorrencia: Recorrencia
  dia_vencimento: number
  mes_vencimento?: number
  ativo: boolean
  dias_antecedencia: number
  criado_em: string
  atualizado_em: string
}

export interface CobrancaConfigIn {
  valor: number
  recorrencia: Recorrencia
  dia_vencimento: number
  mes_vencimento?: number
  ativo?: boolean
  dias_antecedencia?: number
}

export interface Cobranca {
  ref: string
  cobranca_id: string
  aluno_id: string
  personal_id: string
  valor: number
  recorrencia: Recorrencia
  vencimento: string
  status: CobrancaStatus
  forma_pagamento?: FormaPagamento
  origem?: string
  data_pagamento?: string
  mp_payment_id?: string
  mp_valor_liquido?: number
  mp_taxa?: number
  notas?: string
  criado_em: string
  atualizado_em: string
}

export interface NovaCobrancaIn {
  valor: number
  vencimento: string
  recorrencia?: Recorrencia
  notas?: string
}

export interface RegistrarPagamentoIn {
  data_pagamento: string
  notas?: string
  forma_pagamento?: FormaPagamento
}

export interface ChatMidia {
  midia_id: string
  tipo: string
  s3_key: string
  url?: string
}

export interface ChatMensagem {
  mensagem_id: string
  aluno_id: string
  role: 'user' | 'assistant'
  texto: string
  ator: Ator
  canal_origem: CanalOrigem
  data_hora: string
  direto?: boolean
  midia?: ChatMidia
}
