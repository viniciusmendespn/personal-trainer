import { api } from './client'

// ── Tipos (espelham backend/app/models/loja.py + loja_service) ───────────────

export type PedidoStatus =
  | 'AGUARDANDO_PAGAMENTO'
  | 'AGUARDANDO_VENDEDOR'
  | 'ENTREGUE'
  | 'EXPIRADO'
  | 'CANCELADO'

export type AnuncioStatus = 'PUBLICADO' | 'PAUSADO' | 'REMOVIDO_ADMIN'

export interface PacoteStats {
  n_exercicios: number
  n_templates: number
  n_rotinas: number
}

export interface AnuncioCard {
  anuncio_id: string
  titulo: string
  preco_centavos: number
  capa_url?: string | null
  capa_s3_key?: string | null
  vendedor_id: string
  vendedor_nome?: string
  stats: PacoteStats
  avaliacao_media: number | null
  avaliacao_count: number
  vendas_count: number
  criado_em?: string
}

export interface AnuncioDetalhe extends AnuncioCard {
  descricao: string
  status: AnuncioStatus
  pacote_id: string
  pacote_nome?: string
  pacote_versao?: string
  mp_disponivel?: boolean
  avaliacao_soma?: number
}

export interface Avaliacao {
  comprador_id: string
  comprador_nome?: string
  nota: number
  comentario?: string
  criado_em: string
  atualizado_em?: string
}

export interface PixData {
  payment_id: string
  qr_code?: string
  qr_code_base64?: string
  expires_at?: string
  status?: string
}

export interface Pedido {
  pedido_id: string
  anuncio_id: string
  titulo: string
  pacote_id: string
  preco_centavos: number
  vendedor_id: string
  vendedor_nome?: string
  comprador_id: string
  comprador_nome?: string
  modo: 'MP' | 'MANUAL' | 'GRATIS'
  status: PedidoStatus
  mp_payment_id?: string
  expira_em?: string
  entregue_em?: string
  criado_em: string
  pix?: PixData
}

export interface InstalarResponse {
  pacote_id: string
  nome?: string
  exercicios_importados?: number
  templates_importados?: number
  rotinas_importadas?: number
  licenciado?: boolean
}

export interface PacoteGerado {
  pacote_id: string
  nome: string
  descricao?: string
  versao?: string
  max_usos?: number
  n_exercicios?: number
  n_templates?: number
  n_rotinas?: number
  criado_em: string
}

export function formatPreco(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Rótulo de preço para exibição — pacotes com preço 0 são gratuitos (resgate). */
export function precoLabel(centavos: number): string {
  return centavos === 0 ? 'Grátis' : formatPreco(centavos)
}

// ── API ──────────────────────────────────────────────────────────────────────

export const lojaApi = {
  // Público (catálogo)
  catalogo: (cursor?: string | null) =>
    api
      .get<{ anuncios: AnuncioCard[]; cursor: string | null }>('/v1/public/loja/anuncios', {
        params: { limit: 24, cursor: cursor ?? undefined },
      })
      .then((r) => r.data),

  detalhe: (anuncioId: string) =>
    api.get<AnuncioDetalhe>(`/v1/public/loja/anuncios/${anuncioId}`).then((r) => r.data),

  avaliacoes: (anuncioId: string, cursor?: string | null) =>
    api
      .get<{ avaliacoes: Avaliacao[]; cursor: string | null }>(
        `/v1/public/loja/anuncios/${anuncioId}/avaliacoes`,
        { params: { cursor: cursor ?? undefined } },
      )
      .then((r) => r.data),

  // Comprador
  criarPedido: (anuncioId: string) =>
    api.post<Pedido>('/v1/loja/pedidos', { anuncio_id: anuncioId }).then((r) => r.data),

  getPedido: (pedidoId: string) =>
    api.get<Pedido>(`/v1/loja/pedidos/${pedidoId}`).then((r) => r.data),

  instalar: (pedidoId: string) =>
    api.post<InstalarResponse>(`/v1/loja/pedidos/${pedidoId}/instalar`).then((r) => r.data),

  download: (pedidoId: string) =>
    api
      .get<{ fmt: string; pacote_id: string; token: string; filename: string }>(
        `/v1/loja/pedidos/${pedidoId}/download`,
      )
      .then((r) => r.data),

  cancelarPedido: (pedidoId: string) =>
    api.post<Pedido>(`/v1/loja/pedidos/${pedidoId}/cancelar`).then((r) => r.data),

  minhasCompras: () =>
    api
      .get<{ compras: Pedido[]; cursor: string | null }>('/v1/loja/minhas-compras')
      .then((r) => r.data),

  avaliar: (anuncioId: string, nota: number, comentario: string) =>
    api
      .post(`/v1/loja/anuncios/${anuncioId}/avaliacoes`, { nota, comentario })
      .then((r) => r.data),

  // Vendedor
  meusAnuncios: () =>
    api.get<{ anuncios: AnuncioDetalhe[] }>('/v1/loja/meus-anuncios').then((r) => r.data),

  criarAnuncio: (body: {
    pacote_id: string
    titulo: string
    descricao: string
    preco_centavos: number
    capa_s3_key?: string | null
  }) => api.post<AnuncioDetalhe>('/v1/loja/anuncios', body).then((r) => r.data),

  editarAnuncio: (
    anuncioId: string,
    body: Partial<{
      titulo: string
      descricao: string
      preco_centavos: number
      capa_s3_key: string
      pacote_id: string
      status: 'PUBLICADO' | 'PAUSADO'
    }>,
  ) => api.patch<AnuncioDetalhe>(`/v1/loja/anuncios/${anuncioId}`, body).then((r) => r.data),

  capaUploadUrl: (filename: string, contentType: string) =>
    api
      .post<{ upload_url: string; s3_key: string }>('/v1/loja/anuncios/capa-upload-url', {
        filename,
        content_type: contentType,
      })
      .then((r) => r.data),

  minhasVendas: () =>
    api
      .get<{ vendas: Pedido[]; cursor: string | null }>('/v1/loja/minhas-vendas')
      .then((r) => r.data),

  confirmarVenda: (pedidoId: string) =>
    api.post<Pedido>(`/v1/loja/vendas/${pedidoId}/confirmar`).then((r) => r.data),

  cancelarVenda: (pedidoId: string) =>
    api.post<Pedido>(`/v1/loja/vendas/${pedidoId}/cancelar`).then((r) => r.data),

  pacotesGerados: () =>
    api.get<{ pacotes: PacoteGerado[] }>('/v1/pacotes/gerados').then((r) => r.data),
}
