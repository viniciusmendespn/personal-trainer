import { api } from './client'

export interface Nota {
  nota_id: string
  aluno_id: string
  texto: string
  data_hora: string
}

export interface NotaPage {
  items: Nota[]
  next_cursor: string | null
}

export const notasApi = {
  list: (alunoId: string, params: { cursor?: string } = {}) =>
    api.get<NotaPage>(`/v1/alunos/${alunoId}/notas`, { params }).then((r) => r.data),
  create: (alunoId: string, texto: string) =>
    api.post<Nota>(`/v1/alunos/${alunoId}/notas`, { texto }).then((r) => r.data),
}
