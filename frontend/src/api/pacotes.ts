import { api } from './client'
import type { ImportarPacoteResponse, PacoteInstalado } from '../types'

export interface GerarPacoteBody {
  nome: string
  descricao?: string
  autor?: string
  versao?: string
  template_ids: string[]
  rotina_ids: string[]
}

export interface GerarPacoteLicenciadoBody extends GerarPacoteBody {
  max_usos: number
}

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

  importarRascunho: (conteudo: string) =>
    api.post<ImportarPacoteResponse>('/v1/pacotes/importar-rascunho', { conteudo }).then((r) => r.data),

  exportar: (pacoteId: string) =>
    api.get<object>(`/v1/pacotes/${pacoteId}/exportar`).then((r) => r.data),

  gerar: (body: GerarPacoteBody) =>
    api.post<object>('/v1/pacotes/gerar', body).then((r) => r.data),

  gerarLicenciado: (body: GerarPacoteLicenciadoBody) =>
    api.post<object>('/v1/pacotes/gerar-licenciado', body).then((r) => r.data),
}

export function downloadJson(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
