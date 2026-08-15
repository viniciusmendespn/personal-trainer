import { api } from './client'

// Espelho de app/services/pendencia_service.py — manter em sincronia.
export type PendenciaTipo = 'SEM_TREINO_VIGENTE' | 'SEM_TREINAR' | 'PAGAMENTO_ATRASADO'
export type PendenciaSeveridade = 'alta' | 'media'

/** Resumo enxuto que vem junto de cada aluno em GET /v1/alunos (badge do card). */
export interface PendenciaResumo {
  tipo: PendenciaTipo
  severidade: PendenciaSeveridade
  titulo: string
}

/** Versão completa da aba do aluno — `tab` é a aba do cadastro que resolve a pendência. */
export interface Pendencia extends PendenciaResumo {
  detalhe?: string | null
  tab?: string
}

export const pendenciasApi = {
  doAluno: (alunoId: string) =>
    api.get<{ items: Pendencia[] }>(`/v1/alunos/${alunoId}/pendencias`).then((r) => r.data.items),
}
