import { alunoClient } from './alunoClient'
import type { Exercicio, ExercicioSubstituto, Treino } from '../types'
import type { Evolucao, Resumo } from './evolucao'
import type { FeedItem, MidiaExercicio, Relato } from './treinos'

export interface SessaoAtiva {
  sessao_id: string
  treino_nome: string
  ex_atual?: { exercicio_id: string; nome: string; series?: number; reps_prescritas?: string; carga_prescrita?: string }
  ordem_atual: number
  total_ex: number
  data_hora_inicio: string
}

export interface SerieExec {
  carga?: string
  reps?: number
}

export interface AlunoNotificacao {
  ref: string
  notif_id: string
  tipo: string
  titulo: string
  mensagem: string
  lida: boolean
  data_hora: string
  ref_id?: string
  exercicio_id?: string
  relato_sk?: string
}

export interface SessaoHistorico {
  sessao_id: string
  treino_id: string
  treino_nome: string
  status: string
  data_hora_inicio: string
  data_hora_fim?: string
  duracao_segundos?: number
  total_ex: number
  exercicios_exec?: Array<{
    exercicio_id: string
    exercicio_nome: string
    series_exec: Array<{ carga?: string; reps?: number; rpe?: number }>
    series_prescritas?: Array<{ series: number; reps: string; carga?: string }>
    series?: number
    reps_prescritas?: string
    carga_prescrita?: string
    midia?: Array<{ midia_id: string; tipo: string; url?: string; data_hora: string; ator?: 'ALUNO' | 'PERSONAL' }>
    relatos?: Relato[]
  }>
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
  series_prescritas?: Array<{ series: number; reps: string; carga?: string }>
  video_url?: string
  observacoes?: string
  registrado?: SerieInput[] | null
  recursos?: PostGlobal[]
  substitutos_efetivos?: ExercicioSubstituto[]
  substituto_executado?: string | null
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
  me: () => alunoClient.get<{ nome?: string; descricao?: string; foto_url?: string; foto_s3_key?: string }>('/v1/aluno/me').then((r) => r.data),
  updateMe: (body: { nome?: string; descricao?: string; foto_s3_key?: string }) =>
    alunoClient.put('/v1/aluno/me', body).then((r) => r.data),
  meAvatarUploadUrl: (filename: string, contentType: string) =>
    alunoClient.post<{ upload_url: string; s3_key: string }>('/v1/aluno/me/avatar/upload-url', {
      filename, content_type: contentType,
    }).then((r) => r.data),
  conhecimentoList: () =>
    alunoClient.get<{ filename: string }[]>('/v1/aluno/conhecimento').then((r) => r.data),
  conhecimentoDownload: () =>
    alunoClient.get<{ download_url: string }>('/v1/aluno/conhecimento/download').then((r) => r.data),
  personalProfile: () =>
    alunoClient.get<{
      personal_id?: string
      nome?: string
      descricao?: string
      biografia?: string
      experiencia_profissional?: string
      formacao?: string
      foto_url?: string
      instagram_url?: string
      tiktok_url?: string
      youtube_url?: string
      linkedin_url?: string
      facebook_url?: string
      x_url?: string
      site_url?: string
    }>('/v1/aluno/personal').then((r) => r.data),
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
  registrar: (series: SerieInput[], exercicio_id?: string, substituto_nome?: string) =>
    alunoClient.post<{ pr_novo?: number }>('/v1/aluno/registros', { series, exercicio_id, substituto_nome }).then((r) => r.data),
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
  sessoes: (params?: { cursor?: string; limit?: number }) =>
    alunoClient
      .get<{ items: SessaoHistorico[]; next_cursor: string | null }>('/v1/aluno/sessoes', { params })
      .then((r) => r.data),
  sessaoDetalhe: (sessaoId: string) =>
    alunoClient.get<SessaoHistorico>(`/v1/aluno/sessoes/${sessaoId}`).then((r) => r.data),

  notificacoes: (params?: { cursor?: string; limit?: number }) =>
    alunoClient
      .get<{ items: AlunoNotificacao[]; next_cursor: string | null }>('/v1/aluno/notificacoes', { params })
      .then((r) => r.data),
  notificacoesCount: () =>
    alunoClient.get<{ nao_lidas: number }>('/v1/aluno/notificacoes/count').then((r) => r.data),
  marcarNotificacaoLida: (ref: string) =>
    alunoClient.post('/v1/aluno/notificacoes/lida', { ref }).then((r) => r.data),
  feedExercicio: (exercicioId: string) =>
    alunoClient.get<FeedItem[]>(`/v1/aluno/exercicios/${exercicioId}/feed`).then((r) => r.data),
  comentarRelato: (body: { relato_sk: string; texto?: string; midias?: Array<{ s3_key: string; tipo: string }> }) =>
    alunoClient.post('/v1/aluno/relato/comentar', body).then((r) => r.data),
  criarPostagem: (
    exercicioId: string,
    body: {
      tipo: 'DOR' | 'DUVIDA' | 'EXECUCAO' | 'OUTRO'
      descricao?: string
      midias?: Array<{ s3_key: string; tipo: string }>
      exercicio_nome?: string
    },
  ) =>
    alunoClient
      .post<{ ok: number; post_id: string }>(`/v1/aluno/exercicios/${exercicioId}/postagem`, body)
      .then((r) => r.data),
  comentarPost: (body: { post_sk: string; texto?: string; midias?: Array<{ s3_key: string; tipo: string }>; post_tipo?: string }) =>
    alunoClient.post('/v1/aluno/post/comentar', body).then((r) => r.data),

  // Feed global do personal
  feedGlobal: (params?: { cursor?: string; limit?: number }) =>
    alunoClient
      .get<{ items: PostGlobal[]; next_cursor: string | null }>('/v1/aluno/feed', { params })
      .then((r) => r.data),
  feedRecursos: () =>
    alunoClient.get<PostGlobal[]>('/v1/aluno/feed/recursos').then((r) => r.data),
  curtirFeed: (post_sk: string) =>
    alunoClient.post<{ curtido: boolean }>('/v1/aluno/feed/curtir', { post_sk }).then((r) => r.data),

  // Gamificação
  pontos: () =>
    alunoClient.get<{
      total?: number; semana_atual?: number; mes_atual?: number; log_recente?: PontoLog[]
      streak_atual?: number; streak_maximo?: number; multiplicador_atual?: number
    }>('/v1/aluno/pontos').then((r) => r.data),
  ranking: () =>
    alunoClient.get<RankingItem[]>('/v1/aluno/ranking').then((r) => r.data),
  badges: () =>
    alunoClient.get<Array<{ tipo: string; titulo: string; descricao: string; emoji: string; categoria: string; unlocked: boolean; unlocked_at?: string }>>('/v1/aluno/badges').then((r) => r.data),
  metas: () =>
    alunoClient.get<Array<{ meta_id: string; ts_id: string; tipo: string; titulo: string; descricao?: string; valor_alvo: number; unidade: string; status: string; criado_por: string; created_at: string; data_limite?: string; valor_atingido?: number; data_conclusao?: string }>>('/v1/aluno/metas').then((r) => r.data),
  criarMeta: (body: { tipo: string; titulo: string; descricao?: string; valor_alvo: number; unidade: string; exercicio_id?: string; campo_medida?: string; data_limite?: string }) =>
    alunoClient.post('/v1/aluno/metas', body).then((r) => r.data),
}

export interface PostGlobal {
  post_id: string
  post_sk: string
  personal_id: string
  tipo: 'ARTIGO' | 'DICA' | 'MOTIVACAO' | 'AVISO' | 'OUTRO' | 'RECURSO'
  texto: string
  midias: Array<{ s3_key: string; tipo: string; url?: string }>
  total_curtidas: number
  curtido_por_mim: boolean
  data_hora: string
}

export interface RankingItem {
  aluno_id: string
  nome: string
  total_pontos: number
  semana_atual: number
  mes_atual: number
  posicao: number
  eu: boolean
  foto_url?: string | null
}

export interface PontoLog {
  tipo: string
  pts: number
  descricao: string
  data_hora: string
}

/** Pede a presigned URL e sobe o arquivo direto pro S3, depois registra vinculado ao exercício. */
export async function anexarMidiaExecucao(file: File, exercicioId: string, exercicioNome?: string) {
  const { upload_url, s3_key } = await alunoApi.midiaUploadUrl(file.name, file.type)
  await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  const tipo = file.type.startsWith('video') ? 'video_execucao' : 'foto_exercicio'
  return alunoApi.registrarMidia(s3_key, tipo, exercicioId, exercicioNome)
}
