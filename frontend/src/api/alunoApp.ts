import { alunoClient } from './alunoClient'
import type { Exercicio, Treino } from '../types'
import type { Evolucao, Resumo } from './evolucao'

export interface SessaoAtiva {
  sessao_id: string
  treino_nome: string
  ex_atual?: { exercicio_id: string; nome: string; series?: number; reps_prescritas?: string; carga_prescrita?: string }
  ordem_atual: number
  total_ex: number
}

export interface SerieInput {
  carga?: string
  reps?: number
  rpe?: number
}

export interface ExSessao {
  exercicio_id: string
  nome: string
  series?: number
  reps_prescritas?: string
  carga_prescrita?: string
  video_url?: string
  observacoes?: string
  registrado?: SerieInput[] | null
}

export interface SessaoExercicios {
  sessao_id: string
  treino_nome: string
  exercicios: ExSessao[]
}

export interface UltimoTreino {
  treino_nome?: string
  data?: string
}

export interface ProximoTreino {
  treino_id: string
  nome?: string
}

export const alunoApi = {
  me: () => alunoClient.get<{ nome?: string }>('/v1/aluno/me').then((r) => r.data),
  hoje: () =>
    alunoClient
      .get<{ hoje: { id: string; nome: string }[]; treinos: Treino[]; ultimo: UltimoTreino | null; proximo: ProximoTreino | null }>('/v1/aluno/hoje')
      .then((r) => r.data),
  exercicios: (treinoId: string) =>
    alunoClient.get<Exercicio[]>(`/v1/aluno/treinos/${treinoId}/exercicios`).then((r) => r.data),
  sessao: () => alunoClient.get<SessaoAtiva | null>('/v1/aluno/sessao').then((r) => r.data),
  sessaoExercicios: () => alunoClient.get<SessaoExercicios | null>('/v1/aluno/sessao/exercicios').then((r) => r.data),
  start: (treino_id: string) => alunoClient.post<SessaoAtiva>('/v1/aluno/sessao/start', { treino_id }).then((r) => r.data),
  advance: () => alunoClient.post('/v1/aluno/sessao/advance').then((r) => r.data),
  finish: () => alunoClient.post('/v1/aluno/sessao/finish').then((r) => r.data),
  cancel: () => alunoClient.post('/v1/aluno/sessao/cancel').then((r) => r.data),
  registrar: (series: SerieInput[], exercicio_id?: string) =>
    alunoClient.post<{ pr_novo?: number }>('/v1/aluno/registros', { series, exercicio_id }).then((r) => r.data),
  resumo: () => alunoClient.get<Resumo>('/v1/aluno/resumo').then((r) => r.data),
  listExercicios: () => alunoClient.get<Exercicio[]>('/v1/aluno/exercicios').then((r) => r.data),
  evolucao: (id: string) => alunoClient.get<Evolucao>(`/v1/aluno/exercicios/${id}/evolucao`).then((r) => r.data),
}
