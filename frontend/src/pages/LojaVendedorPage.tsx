import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { CheckCircle2, ExternalLink, ImagePlus, Pause, Play, Pencil, Plus, Store } from 'lucide-react'
import {
  lojaApi,
  formatPreco,
  precoLabel,
  type AnuncioDetalhe,
  type PacoteGerado,
  type Pedido,
  type PedidoStatus,
} from '../api/loja'
import {
  Badge, Button, Card, EmptyState, Input, Modal, RichTextEditor, Select, Spinner, Tabs,
  useConfirm, useToast,
} from '../components/ui'
import { MEDIA_CACHE_CONTROL } from '../utils/media'

const LOJA_URL = 'https://loja.coachpilot.com.br'

const STATUS_ANUNCIO: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  PUBLICADO: { label: 'Publicado', tone: 'success' },
  PAUSADO: { label: 'Pausado', tone: 'warning' },
  REMOVIDO_ADMIN: { label: 'Removido pela administração', tone: 'danger' },
}

const STATUS_PEDIDO: Record<PedidoStatus, { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' }> = {
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando PIX', tone: 'warning' },
  AGUARDANDO_VENDEDOR: { label: 'Aguardando sua confirmação', tone: 'info' },
  ENTREGUE: { label: 'Entregue', tone: 'success' },
  EXPIRADO: { label: 'Expirado', tone: 'neutral' },
  CANCELADO: { label: 'Cancelado', tone: 'neutral' },
}

// ── Form de anúncio (criar/editar) ──────────────────────────────────────────

interface FormState {
  pacote_id: string
  titulo: string
  descricao: string
  preco: string          // em reais, convertido para centavos no submit
  gratuito: boolean      // preco_centavos = 0 (resgate sem pagamento)
  capa_s3_key: string | null
}

function AnuncioFormModal({
  anuncio,
  onClose,
}: {
  anuncio: AnuncioDetalhe | null   // null = criar
  onClose: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>({
    pacote_id: anuncio?.pacote_id ?? '',
    titulo: anuncio?.titulo ?? '',
    descricao: anuncio?.descricao ?? '',
    preco: anuncio && anuncio.preco_centavos > 0
      ? (anuncio.preco_centavos / 100).toFixed(2).replace('.', ',')
      : '',
    gratuito: anuncio ? anuncio.preco_centavos === 0 : false,
    capa_s3_key: anuncio?.capa_s3_key ?? null,
  })
  const [capaPreview, setCapaPreview] = useState<string | null>(anuncio?.capa_url ?? null)
  const [uploadingCapa, setUploadingCapa] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { data: geradosData } = useQuery({
    queryKey: ['pacotes-gerados'],
    queryFn: lojaApi.pacotesGerados,
  })
  const gerados: PacoteGerado[] = geradosData?.pacotes ?? []

  async function handleCapa(file: File) {
    setUploadingCapa(true)
    try {
      const { upload_url, s3_key } = await lojaApi.capaUploadUrl(file.name, file.type)
      await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type, 'Cache-Control': MEDIA_CACHE_CONTROL },
      })
      setForm((f) => ({ ...f, capa_s3_key: s3_key }))
      setCapaPreview(URL.createObjectURL(file))
    } catch {
      toast.show('Falha no upload da capa.', 'error')
    } finally {
      setUploadingCapa(false)
    }
  }

  function precoCentavos(): number {
    if (form.gratuito) return 0
    const n = parseFloat(form.preco.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? Math.round(n * 100) : 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const centavos = precoCentavos()
    if (!form.gratuito && (centavos < 100 || centavos > 500000)) {
      setError('Preço deve ser entre R$ 1,00 e R$ 5.000,00 — ou marque "Pacote gratuito".')
      return
    }
    if (!anuncio && !form.pacote_id) {
      setError('Selecione o pacote licenciado que será vendido.')
      return
    }
    setSaving(true)
    try {
      if (anuncio) {
        await lojaApi.editarAnuncio(anuncio.anuncio_id, {
          titulo: form.titulo,
          descricao: form.descricao,
          preco_centavos: centavos,
          ...(form.capa_s3_key ? { capa_s3_key: form.capa_s3_key } : {}),
          ...(form.pacote_id && form.pacote_id !== anuncio.pacote_id ? { pacote_id: form.pacote_id } : {}),
        })
        toast.show('Anúncio atualizado.', 'success')
      } else {
        await lojaApi.criarAnuncio({
          pacote_id: form.pacote_id,
          titulo: form.titulo,
          descricao: form.descricao,
          preco_centavos: centavos,
          capa_s3_key: form.capa_s3_key,
        })
        toast.show('Anúncio publicado na loja!', 'success')
      }
      qc.invalidateQueries({ queryKey: ['loja-meus-anuncios'] })
      onClose()
    } catch (err) {
      const code = isAxiosError(err) ? err.response?.data?.detail?.code : undefined
      if (code === 'PACOTE_NAO_E_SEU') setError('Este pacote não foi gerado por você.')
      else if (code === 'PACOTE_INDISPONIVEL') setError('Pacote indisponível — gere um pacote licenciado primeiro.')
      else setError('Não foi possível salvar o anúncio. Verifique os campos e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open size="lg" title={anuncio ? 'Editar anúncio' : 'Anunciar pacote na loja'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Pacote licenciado (versão vendida)"
          value={form.pacote_id}
          onChange={(e) => setForm((f) => ({ ...f, pacote_id: e.target.value }))}
          required={!anuncio}
        >
          <option value="">Selecione um pacote gerado…</option>
          {gerados.map((p) => (
            <option key={p.pacote_id} value={p.pacote_id}>
              {p.nome} (v{p.versao ?? '1'} — {p.n_rotinas ?? 0} rotinas, {p.n_templates ?? 0} treinos, {p.n_exercicios ?? 0} exercícios)
            </option>
          ))}
        </Select>
        {gerados.length === 0 && !anuncio && (
          <p className="text-xs text-warning">
            Você ainda não gerou nenhum pacote licenciado. Vá em <b>Pacotes → Criar pacote</b>, ative o modo
            Licenciado e gere o pacote — depois volte aqui para anunciar.
          </p>
        )}

        <Input
          label="Título do anúncio"
          value={form.titulo}
          onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
          maxLength={120}
          required
          placeholder="Ex.: Método Hipertrofia 12 semanas — ABC completo"
        />

        <RichTextEditor
          label="Descrição completa"
          value={form.descricao}
          onChange={(html) => setForm((f) => ({ ...f, descricao: html }))}
          placeholder="Descreva seu método: para quem é, o que inclui, como aplicar, resultados esperados…"
        />

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-text">
            <input
              type="checkbox"
              checked={form.gratuito}
              onChange={(e) => setForm((f) => ({ ...f, gratuito: e.target.checked }))}
              className="accent-accent"
            />
            Pacote gratuito (resgate sem pagamento)
          </label>
          {form.gratuito ? (
            <p className="text-xs text-text-muted">
              Qualquer personal poderá resgatar e instalar este pacote pela loja, sem pagar.
            </p>
          ) : (
            <Input
              label="Preço (R$)"
              value={form.preco}
              onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
              inputMode="decimal"
              required
              placeholder="97,00"
            />
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-text-secondary mb-1">Imagem de capa</p>
          <div className="flex items-center gap-3">
            {capaPreview && (
              <img src={capaPreview} alt="Capa" className="w-28 aspect-video object-cover rounded-lg border border-border" />
            )}
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-border-strong px-3 py-2 text-xs text-text-secondary hover:border-accent hover:text-text transition-colors">
              <ImagePlus size={14} />
              {uploadingCapa ? 'Enviando…' : capaPreview ? 'Trocar imagem' : 'Enviar imagem'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingCapa}
                onChange={(e) => e.target.files?.[0] && handleCapa(e.target.files[0])}
              />
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || uploadingCapa}>
            {saving ? 'Salvando…' : anuncio ? 'Salvar alterações' : 'Publicar anúncio'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Aba Anúncios ─────────────────────────────────────────────────────────────

function AnunciosTab() {
  const toast = useToast()
  const qc = useQueryClient()
  const [editando, setEditando] = useState<AnuncioDetalhe | null>(null)
  const [criando, setCriando] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['loja-meus-anuncios'],
    queryFn: lojaApi.meusAnuncios,
  })
  const anuncios = data?.anuncios ?? []

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'PUBLICADO' | 'PAUSADO' }) =>
      lojaApi.editarAnuncio(id, { status }),
    onSuccess: (_r, v) => {
      toast.show(v.status === 'PAUSADO' ? 'Anúncio pausado.' : 'Anúncio publicado.', 'success')
      qc.invalidateQueries({ queryKey: ['loja-meus-anuncios'] })
    },
    onError: () => toast.show('Não foi possível alterar o status.', 'error'),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Seus anúncios aparecem em{' '}
          <a href={LOJA_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline inline-flex items-center gap-0.5">
            loja.coachpilot.com.br <ExternalLink size={12} />
          </a>
        </p>
        <Button size="sm" onClick={() => setCriando(true)}>
          <Plus size={14} className="mr-1" /> Anunciar pacote
        </Button>
      </div>

      {anuncios.length === 0 && (
        <EmptyState
          icon={<Store />}
          title="Você ainda não anunciou nenhum pacote"
          description="Gere um pacote licenciado em Pacotes e anuncie seu método para outros personais."
          action={<Button onClick={() => setCriando(true)}><Plus size={14} className="mr-1" /> Anunciar pacote</Button>}
        />
      )}

      <div className="space-y-3">
        {anuncios.map((a) => {
          const st = STATUS_ANUNCIO[a.status] ?? { label: a.status, tone: 'neutral' as const }
          return (
            <Card key={a.anuncio_id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {a.capa_url ? (
                    <img src={a.capa_url} alt="" className="w-20 aspect-video object-cover rounded-lg border border-border shrink-0" />
                  ) : (
                    <div className="w-20 aspect-video rounded-lg border border-border bg-surface flex items-center justify-center shrink-0">
                      <Store size={18} className="text-text-muted" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-text line-clamp-1">{a.titulo}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {precoLabel(a.preco_centavos)} · {a.vendas_count}{' '}
                      {a.preco_centavos === 0 ? 'resgate' : 'venda'}{a.vendas_count === 1 ? '' : 's'}
                      {a.avaliacao_count > 0 && a.avaliacao_media != null && ` · ★ ${a.avaliacao_media.toFixed(1)} (${a.avaliacao_count})`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {a.status !== 'REMOVIDO_ADMIN' && (
                    <>
                      <Button size="sm" variant="ghost" iconOnly aria-label="Editar" onClick={() => setEditando(a)}>
                        <Pencil size={14} />
                      </Button>
                      {a.status === 'PUBLICADO' ? (
                        <Button size="sm" variant="ghost" iconOnly aria-label="Pausar"
                          onClick={() => toggleStatus.mutate({ id: a.anuncio_id, status: 'PAUSADO' })}>
                          <Pause size={14} />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" iconOnly aria-label="Publicar"
                          onClick={() => toggleStatus.mutate({ id: a.anuncio_id, status: 'PUBLICADO' })}>
                          <Play size={14} />
                        </Button>
                      )}
                      <a
                        href={`${LOJA_URL}/anuncio/${a.anuncio_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-text"
                        aria-label="Ver na loja"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {(criando || editando) && (
        <AnuncioFormModal anuncio={editando} onClose={() => { setCriando(false); setEditando(null) }} />
      )}
    </div>
  )
}

// ── Aba Vendas ───────────────────────────────────────────────────────────────

function VendasTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['loja-minhas-vendas'],
    queryFn: lojaApi.minhasVendas,
  })
  const vendas: Pedido[] = data?.vendas ?? []

  const confirmar = useMutation({
    mutationFn: (pedidoId: string) => lojaApi.confirmarVenda(pedidoId),
    onSuccess: () => {
      toast.show('Recebimento confirmado — pacote liberado ao comprador!', 'success')
      qc.invalidateQueries({ queryKey: ['loja-minhas-vendas'] })
    },
    onError: () => toast.show('Não foi possível confirmar. Recarregue e tente novamente.', 'error'),
  })

  const cancelar = useMutation({
    mutationFn: (pedidoId: string) => lojaApi.cancelarVenda(pedidoId),
    onSuccess: () => {
      toast.show('Pedido cancelado.', 'info')
      qc.invalidateQueries({ queryKey: ['loja-minhas-vendas'] })
    },
    onError: () => toast.show('Não foi possível cancelar.', 'error'),
  })

  async function handleConfirmar(p: Pedido) {
    const ok = await confirm({
      title: 'Confirmar recebimento?',
      message: `Confirma que recebeu ${formatPreco(p.preco_centavos)} de ${p.comprador_nome || 'comprador'} por "${p.titulo}"? O pacote será liberado imediatamente.`,
    })
    if (ok) confirmar.mutate(p.pedido_id)
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-3">
      {vendas.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 />}
          title="Nenhuma venda ainda"
          description="Quando alguém comprar um dos seus pacotes, o pedido aparece aqui."
        />
      )}
      {vendas.map((p) => {
        const st = STATUS_PEDIDO[p.status] ?? { label: p.status, tone: 'neutral' as const }
        return (
          <Card key={p.pedido_id} className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-text line-clamp-1">{p.titulo}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {precoLabel(p.preco_centavos)} · comprador: {p.comprador_nome || '—'} ·{' '}
                  {new Date(p.criado_em).toLocaleDateString('pt-BR')} ·{' '}
                  {p.modo === 'GRATIS' ? 'resgate gratuito' : p.modo === 'MP' ? 'PIX automático' : 'pagamento por fora'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone={st.tone}>{st.label}</Badge>
                {p.status === 'AGUARDANDO_VENDEDOR' && (
                  <>
                    <Button size="sm" onClick={() => handleConfirmar(p)} disabled={confirmar.isPending}>
                      <CheckCircle2 size={14} className="mr-1" /> Confirmar recebimento
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => cancelar.mutate(p.pedido_id)} disabled={cancelar.isPending}>
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────

export function LojaVendedorPage() {
  const [tab, setTab] = useState('anuncios')
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>Loja</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Venda seu método para outros personais — anuncie pacotes licenciados e gerencie suas vendas.
        </p>
      </div>
      <Tabs
        tabs={[
          { key: 'anuncios', label: 'Meus anúncios' },
          { key: 'vendas', label: 'Vendas' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'anuncios' ? <AnunciosTab /> : <VendasTab />}
    </div>
  )
}
