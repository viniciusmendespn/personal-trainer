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
  objetivo?: string
  observacoes?: string
  custom?: Custom
  created_at: string
  updated_at: string
}

export interface AlunoCreate {
  nome: string
  telefone: string
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
  dias_semana?: number[]
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
  dias_semana?: number[]
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
  created_at: string
}

export interface ExLib {
  exlib_id: string
  nome: string
  grupo?: string
  video_url?: string
  descricao?: string
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
