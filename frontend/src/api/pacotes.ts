import { api } from './client'
import type { ImportarPacoteResponse, PacoteInstalado } from '../types'

export const pacotesApi = {
  importar: (conteudo: string) =>
    api.post<ImportarPacoteResponse>('/v1/pacotes/importar', { conteudo }).then((r) => r.data),

  list: () =>
    api.get<PacoteInstalado[]>('/v1/pacotes').then((r) => r.data),

  togglePacote: (pacoteId: string, ativo: boolean) =>
    api.patch(`/v1/pacotes/${pacoteId}`, { ativo }).then((r) => r.data),

  toggleItem: (pacoteId: string, itemId: string, ativo: boolean) =>
    api.patch(`/v1/pacotes/${pacoteId}/items/${itemId}`, { ativo }).then((r) => r.data),

  remover: (pacoteId: string) =>
    api.delete(`/v1/pacotes/${pacoteId}`),
}
