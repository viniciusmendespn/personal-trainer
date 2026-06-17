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
  custom?: Custom
  created_at: string
  updated_at: string
}

export interface AlunoCreate {
  nome: string
  telefone: string
  email?: string
  endereco?: string
  data_nascimento?: string
  objetivo?: string
  observacoes?: string
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

export interface Avaliacao {
  avaliacao_id: string
  aluno_id: string
  data?: string
  peso?: number
  altura_cm?: number
  percentual_gordura?: number
  medidas?: Custom
  observacoes?: string
  fotos_s3_keys?: string[]
  bio_scan_s3_key?: string
  fotos_urls?: string[]
  bio_scan_url?: string
  created_at: string
}

export interface ExLib {
  exlib_id: string
  nome: string
  grupo?: string
  video_url?: string
  descricao?: string
  recomendacoes?: string
}

export interface Exercicio {
  exercicio_id: string
  treino_id: string
  aluno_id: string
  nome: string
  ordem: number
  dia_semana?: number | null
  series?: number
  reps_prescritas?: string
  carga_prescrita?: string
  intervalo_s?: number
  video_url?: string
  observacoes?: string
  custom?: Custom
}

export interface ExercicioCreate {
  nome: string
  ordem?: number
  dia_semana?: number | null
  series?: number
  reps_prescritas?: string
  carga_prescrita?: string
  intervalo_s?: number
  video_url?: string
  observacoes?: string
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
  status: 'CONNECTED' | 'DISCONNECTED'
  connected: boolean
  phone?: string
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
  dia_semana?: number | null
  series?: number
  reps_prescritas?: string
  carga_prescrita?: string
  intervalo_s?: number
  video_url?: string
  observacoes?: string
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

export type CanalOrigem = 'WHATSAPP' | 'PORTAL'
export type Ator = 'ALUNO' | 'PERSONAL'

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
