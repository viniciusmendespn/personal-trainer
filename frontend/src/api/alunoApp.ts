import { alunoClient } from './alunoClient'
import type { Exercicio, Treino } from '../types'
import type { Evolucao, Resumo } from './evolucao'
import type { MidiaExercicio } from './treinos'

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
  listMidia: (exercicioId: string) =>
    alunoClient.get<MidiaExercicio[]>(`/v1/aluno/exercicios/${exercicioId}/midia`).then((r) => r.data),
  midiaUploadUrl: (filename: string, contentType: string) =>
    alunoClient.post<{ upload_url: string; s3_key: string }>('/v1/aluno/midia/upload-url', {
      filename, content_type: contentType,
    }).then((r) => r.data),
  registrarMidia: (s3Key: string, tipo: string, exercicioId: string, exercicioNome?: string) =>
    alunoClient.post('/v1/aluno/midia', {
      s3_key: s3Key, tipo, exercicio_id: exercicioId, exercicio_nome: exercicioNome,
    }).then((r) => r.data),
  relato: (tipo: 'dor' | 'duvida', descricao: string, exercicioId?: string, exercicioNome?: string) =>
    alunoClient.post('/v1/aluno/relato', {
      tipo, descricao, exercicio_id: exercicioId, exercicio_nome: exercicioNome,
    }).then((r) => r.data),
}

/** Pede a presigned URL e sobe o arquivo direto pro S3, depois registra vinculado ao exercício. */
export async function anexarMidiaExecucao(file: File, exercicioId: string, exercicioNome?: string) {
  const { upload_url, s3_key } = await alunoApi.midiaUploadUrl(file.name, file.type)
  await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  const tipo = file.type.startsWith('video') ? 'video_execucao' : 'foto_exercicio'
  return alunoApi.registrarMidia(s3_key, tipo, exercicioId, exercicioNome)
}
