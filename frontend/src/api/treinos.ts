import { api } from './client'
import type { Exercicio, ExercicioCreate, Treino, TreinoCreate } from '../types'
import type { HistoricoMes } from './alunoApp'
import type { ProblemaImport } from '../utils/erroApi'

export const treinosApi = {
  list: (alunoId: string) =>
    api.get<Treino[]>(`/v1/alunos/${alunoId}/treinos`).then((r) => r.data),
  create: (alunoId: string, body: TreinoCreate) =>
    api.post<Treino>(`/v1/alunos/${alunoId}/treinos`, body).then((r) => r.data),
  update: (alunoId: string, treinoId: string, body: TreinoCreate) =>
    api.put<Treino>(`/v1/alunos/${alunoId}/treinos/${treinoId}`, body).then((r) => r.data),
  remove: (alunoId: string, treinoId: string) =>
    api.delete(`/v1/alunos/${alunoId}/treinos/${treinoId}`),

  exportarPrograma: (alunoId: string) =>
    api.get<object>(`/v1/alunos/${alunoId}/treinos/exportar`).then((r) => r.data),
  importarPrograma: (alunoId: string, conteudo: string) =>
    api
      .post<ImportarProgramaResponse>(`/v1/alunos/${alunoId}/treinos/importar`, { conteudo })
      .then((r) => r.data),
  /** Confere o JSON sem gravar nada. Recusa vem como 400, no mesmo formato do import. */
  validarPrograma: (alunoId: string, conteudo: string) =>
    api
      .post<ValidarProgramaResponse>(`/v1/alunos/${alunoId}/treinos/validar`, { conteudo })
      .then((r) => r.data),

  listExercicios: (alunoId: string, treinoId: string) =>
    api.get<Exercicio[]>(`/v1/alunos/${alunoId}/treinos/${treinoId}/exercicios`).then((r) => r.data),
  createExercicio: (alunoId: string, treinoId: string, body: ExercicioCreate) =>
    api
      .post<Exercicio>(`/v1/alunos/${alunoId}/treinos/${treinoId}/exercicios`, body)
      .then((r) => r.data),
  updateExercicio: (alunoId: string, treinoId: string, exercicioId: string, body: ExercicioCreate) =>
    api
      .put<Exercicio>(`/v1/alunos/${alunoId}/treinos/${treinoId}/exercicios/${exercicioId}`, body)
      .then((r) => r.data),
  removeExercicio: (alunoId: string, treinoId: string, exercicioId: string) =>
    api.delete(`/v1/alunos/${alunoId}/treinos/${treinoId}/exercicios/${exercicioId}`),

  listMidia: (alunoId: string, exercicioId: string) =>
    api.get<MidiaExercicio[]>(`/v1/alunos/${alunoId}/exercicios/${exercicioId}/midia`).then((r) => r.data),

  uploadUrlMidia: (alunoId: string, filename: string, contentType: string) =>
    api
      .post<{ upload_url: string; s3_key: string }>(`/v1/alunos/${alunoId}/midia/upload-url`, {
        filename, content_type: contentType,
      })
      .then((r) => r.data),
  enviarCorrecao: (
    alunoId: string,
    body: { s3_key: string; tipo: string; exercicio_id: string; exercicio_nome?: string; texto?: string },
  ) =>
    api
      .post<{ ok: number; midia_id: string; whatsapp_enviado: boolean }>(`/v1/alunos/${alunoId}/midia/correcao`, body)
      .then((r) => r.data),
  listSessoes: (alunoId: string, params?: { cursor?: string; limit?: number }) =>
    api
      .get<{ items: SessaoHistoricoPersonal[]; next_cursor: string | null }>(`/v1/alunos/${alunoId}/sessoes`, { params })
      .then((r) => r.data),
  sessaoDetalhe: (alunoId: string, sessaoId: string) =>
    api.get<SessaoDetalhe>(`/v1/alunos/${alunoId}/sessoes/${sessaoId}`).then((r) => r.data),
  historicoMesAluno: (alunoId: string, ano: number, mes: number) =>
    api.get<HistoricoMes>(`/v1/alunos/${alunoId}/historico/mes`, { params: { ano, mes } }).then((r) => r.data),

  feedExercicio: (alunoId: string, exercicioId: string) =>
    api.get<FeedItem[]>(`/v1/alunos/${alunoId}/exercicios/${exercicioId}/feed`).then((r) => r.data),

  /** Feed pelo nome canônico do exercício — funciona p/ exercício fora do programa atual. */
  feedExercicioPorChave: (alunoId: string, chave: string, cursor?: string) =>
    api
      .get<{ items: FeedItem[]; next_cursor: string | null }>(`/v1/alunos/${alunoId}/exercicios/feed`, { params: { chave, cursor } })
      .then((r) => r.data),

  criarCorrecao: (
    alunoId: string,
    body: { exercicio_id: string; exercicio_nome?: string; texto: string; midias: Array<{ s3_key: string; tipo: string }> },
  ) => api.post<{ ok: number; correcao_id: string }>(`/v1/alunos/${alunoId}/exercicios/${body.exercicio_id}/correcao`, body).then((r) => r.data),

  criarPostagemPersonal: (
    alunoId: string,
    exercicioId: string,
    body: { tipo?: 'CORRECAO' | 'EXECUCAO' | 'OUTRO'; exercicio_nome?: string; descricao?: string; midias?: Array<{ s3_key: string; tipo: string }> },
  ) =>
    api
      .post<{ ok: number; post_id: string }>(`/v1/alunos/${alunoId}/exercicios/${exercicioId}/postagem`, body)
      .then((r) => r.data),

  /** Postagem body-based: identifica o exercício pelo nome; id só quando está no programa atual. */
  criarPostagemPersonalV2: (
    alunoId: string,
    body: { tipo?: 'CORRECAO' | 'EXECUCAO' | 'OUTRO'; exercicio_nome: string; exercicio_id?: string; descricao?: string; midias?: Array<{ s3_key: string; tipo: string }> },
  ) =>
    api.post<{ ok: number; post_id: string }>(`/v1/alunos/${alunoId}/postagens`, body).then((r) => r.data),

  responderNotificacao: (body: { ref: string; texto: string; aluno_id: string }) =>
    api.post('/v1/notificacoes/responder', body).then((r) => r.data),
  comentarRelato: (alunoId: string, body: { relato_sk: string; texto?: string; midias?: Array<{ s3_key: string; tipo: string }> }) =>
    api.post(`/v1/alunos/${alunoId}/relato/comentar`, body).then((r) => r.data),
  comentarPost: (alunoId: string, body: { post_sk: string; texto?: string; midias?: Array<{ s3_key: string; tipo: string }>; post_tipo?: string }) =>
    api.post(`/v1/alunos/${alunoId}/post/comentar`, body).then((r) => r.data),
}

export interface ImportarProgramaResponse {
  treinos_importados: number
  exercicios_importados: number
  /** Achados que não impediram a gravação (ver validacao_programa.py no backend). */
  avisos?: ProblemaImport[]
  relatorio_ia?: string | null
}

export interface ValidarProgramaResponse {
  ok: boolean
  contagem: { treinos: number; exercicios: number; avisos: number }
  avisos: ProblemaImport[]
  relatorio_ia?: string | null
}

export interface Relato {
  tipo: 'DOR' | 'DUVIDA'
  descricao: string
  data_hora: string
  exercicio_id?: string
  exercicio_nome?: string
  respondido: boolean
  resposta_texto?: string
  respondido_em?: string
  sessao_id?: string
}

export interface Comentario {
  com_id: string
  ator: 'ALUNO' | 'PERSONAL'
  texto?: string
  data_hora: string
  midias?: Array<{ s3_key: string; tipo: string; url?: string }>
}

export interface FeedItem {
  tipo: 'DOR' | 'DUVIDA' | 'CORRECAO' | 'EXECUCAO' | 'OUTRO'
  ator?: 'ALUNO' | 'PERSONAL'
  data_hora: string
  // Thread (DOR / DUVIDA / EXECUCAO com texto)
  descricao?: string
  respondido?: boolean
  resposta_texto?: string
  respondido_em?: string
  relato_sk?: string
  comentarios?: Comentario[]
  // Mídia (CORRECAO / EXECUCAO / POST com mídia)
  post_id?: string
  correcao_id?: string
  texto?: string
  midias?: Array<{ s3_key: string; tipo: string; url?: string }>
  exercicio_nome?: string
}

export interface ExecExercicio {
  exercicio_id: string
  exercicio_nome: string
  tipo_exercicio?: string   // 'FORCA' | 'PERFORMANCE' (+ legados na leitura)
  series_exec: Array<{ carga?: string; reps?: number; rpe?: number }>
  pse?: number   // percepção de esforço do exercício (0-10)
  series_prescritas?: Array<{ series: number; reps: string; carga?: string }>
  series?: number
  reps_prescritas?: string
  carga_prescrita?: string
  midia?: MidiaExercicio[]
  relatos?: Relato[]
}

/** Exercício PRESCRITO (snapshot do treino no momento da sessão) — existe mesmo quando o
 * aluno não registrou nada (ex.: movimentos de um WOD, cujo resultado é o score do bloco). */
export interface ExercicioPrescritoSessao {
  exercicio_id: string
  nome?: string
  bloco_id?: string | null
  aquecimento?: boolean
  tipo_exercicio?: string
  unidade_reps?: string
  unidade_carga?: string
  series_prescritas?: Array<{ series: number; reps: string; carga?: string }>
}

export interface SessaoHistoricoPersonal {
  sessao_id: string
  treino_id: string
  treino_nome: string
  status: string
  data_hora_inicio: string
  data_hora_fim?: string
  duracao_segundos?: number
  /** Sessão que o aluno esqueceu de finalizar e o sistema fechou sozinho 6h depois do início.
   *  Nesse caso `data_hora_fim` é a hora do último registro, não a do fechamento. */
  encerrada_automaticamente?: boolean
  total_ex: number
  /** Todos os exercícios prescritos no treino (independente de terem sido registrados). */
  exercicios?: ExercicioPrescritoSessao[]
  exercicios_exec?: ExecExercicio[]
}

export interface SessaoDetalhe extends SessaoHistoricoPersonal {
  exercicios_exec: ExecExercicio[]
}

export interface MidiaExercicio {
  midia_id: string
  tipo: string
  s3_key: string
  exercicio_id: string
  exercicio_nome?: string
  status: string
  data_hora: string
  url?: string
  ator?: 'ALUNO' | 'PERSONAL'
}
