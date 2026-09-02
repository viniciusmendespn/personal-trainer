import { api } from './client'
import type { Exercicio } from '../types'

export interface PontoEvolucao {
  data: string
  carga_max?: number | null
  volume?: number | null
  reps?: string
  metrica_max?: number | null
  irm?: number | null
}

export interface Evolucao {
  tipo?: string
  direcao?: 'MAIOR' | 'MENOR'
  serie: PontoEvolucao[]
  pr: { carga: number; data: string } | null
  total_sessoes: number
  nome?: string | null
  chave?: string
}

/** Série executada de uma sessão do histórico (mesmo shape que series_exec do app do aluno). */
export interface SerieHistorico {
  carga?: string
  reps?: number
  aquecimento?: boolean
  contexto?: boolean
}

/** Uma sessão do histórico de execução de um exercício. */
export interface SessaoHistorico {
  data_hora: string
  series_exec: SerieHistorico[]
  pse?: number   // percepção de esforço do exercício naquela execução (0-10)
}

/** Item do seletor de evolução (historico=1): identidade por nome canônico (chave). */
export interface ExercicioEvolucao {
  chave: string
  nome: string
  atual: boolean
  exercicio_id?: string | null
  exercicio_ids?: string[]
  tipo_exercicio?: string
  /** Grupos musculares atingidos. `grupo` é derivado (join) e é o único campo dos
   *  itens antigos — leia sempre via `gruposDoExercicio` (utils/grupos.ts). */
  grupos?: string[]
  grupo?: string
  unidade_carga?: string
  unidade_reps?: string
  metrica_direcao?: 'MAIOR' | 'MENOR'
  rm_kg?: number
  carga_prescrita?: string
  wod?: boolean                   // entrada de WOD (chave "wod#...") — score do bloco
  formato?: string                // FOR_TIME | AMRAP | EMOM (quando wod)
}

/** Recorde de um exercício (item STATS#PR#), como o resumo o devolve. */
export interface PrItem {
  exercicio: string
  carga: number
  data: string
  chave?: string
  direcao?: 'MAIOR' | 'MENOR'
  formato?: string
  wod?: boolean
  unidade?: string | null
  rx?: boolean
  /** Preenchidos quando o recorde foi corrigido à mão — a marca não some depois. */
  editado_em?: string | null
  editado_por?: 'ALUNO' | 'PERSONAL' | null
}

/** Recorde corrigido, como o PUT devolve (item cru, não a projeção do resumo). */
export interface PrCorrigido {
  carga: number
  data?: string
  exercicio_nome?: string
  editado_em?: string
  editado_por?: 'ALUNO' | 'PERSONAL'
}

export interface ResumoSemana {
  semana: string
  volume: number
  sessoes: number
  grupos?: Record<string, number>
}

export interface Resumo {
  total_sessoes: number
  total_volume: number
  ultimo_treino: string | null
  sessoes_semana: number
  semanas: ResumoSemana[]
  prs: PrItem[]
  streak_atual?: number
  streak_maximo?: number
  multiplicador_atual?: number
  media_sessoes_semana?: number
  volume_por_grupo?: { grupo: string; volume: number }[]
  tempo_medio_segundos?: number | null       // duração média de treino
  tempo_medio_serie_segundos?: number | null // estimado (duração ÷ nº de séries, inclui descanso)
  dias_semana?: number[]                      // [seg..dom] contagem de execuções por dia da semana
}

export const evolucaoApi = {
  listExercicios: (alunoId: string) =>
    api.get<Exercicio[]>(`/v1/alunos/${alunoId}/exercicios`).then((r) => r.data),
  /** Todos os exercícios já feitos (programa atual + histórico), em ordem alfabética. */
  listExerciciosHistorico: (alunoId: string) =>
    api.get<ExercicioEvolucao[]>(`/v1/alunos/${alunoId}/exercicios`, { params: { historico: 1 } }).then((r) => r.data),
  get: (alunoId: string, exercicioId: string) =>
    api.get<Evolucao>(`/v1/alunos/${alunoId}/exercicios/${exercicioId}/evolucao`).then((r) => r.data),
  /** Últimas sessões executadas (com séries/reps/carga) — para exibir a "última vez" na prescrição. */
  historico: (alunoId: string, exercicioId: string, limit = 1) =>
    api
      .get<SessaoHistorico[]>(`/v1/alunos/${alunoId}/exercicios/${exercicioId}/historico`, { params: { limit } })
      .then((r) => r.data),
  /** Evolução pelo nome canônico — funciona p/ exercício fora do programa atual. */
  getPorChave: (alunoId: string, chave: string) =>
    api.get<Evolucao>(`/v1/alunos/${alunoId}/exercicios/evolucao`, { params: { chave } }).then((r) => r.data),
  resumo: (alunoId: string) =>
    api.get<Resumo>(`/v1/alunos/${alunoId}/resumo`).then((r) => r.data),
  /** Corrige o valor de um recorde. Não conta como recorde novo (sem ponto/meta/badge). */
  atualizarPr: (alunoId: string, chave: string, carga: number) =>
    api.put<PrCorrigido>(`/v1/alunos/${alunoId}/exercicios/pr`, { chave, carga }).then((r) => r.data),
  excluirPr: (alunoId: string, chave: string) =>
    api.delete(`/v1/alunos/${alunoId}/exercicios/pr`, { params: { chave } }).then((r) => r.data),
}
