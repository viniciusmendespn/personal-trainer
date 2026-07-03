import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ArrowLeft, Dumbbell, HandCoins, Layers, Repeat, ShieldCheck, Zap } from 'lucide-react'
import { lojaApi, formatPreco, type Pedido } from '../../api/loja'
import { Button, Card, Modal, Spinner, useToast } from '../../components/ui'
import { StarRating } from '../StarRating'
import { CheckoutPixModal } from '../CheckoutPixModal'
import { isLoggedIn } from '../useLojaAuth'

export function AnuncioDetailPage() {
  const { anuncioId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [buying, setBuying] = useState(false)
  const [pedidoPix, setPedidoPix] = useState<Pedido | null>(null)
  const [pedidoManual, setPedidoManual] = useState<Pedido | null>(null)

  const { data: anuncio, isLoading, isError } = useQuery({
    queryKey: ['loja-anuncio', anuncioId],
    queryFn: () => lojaApi.detalhe(anuncioId),
    enabled: !!anuncioId,
  })

  const { data: avaliacoesData } = useQuery({
    queryKey: ['loja-avaliacoes', anuncioId],
    queryFn: () => lojaApi.avaliacoes(anuncioId),
    enabled: !!anuncioId,
  })

  useEffect(() => {
    if (anuncio?.titulo) document.title = `${anuncio.titulo} — Loja CoachPilot`
    return () => { document.title = 'Loja CoachPilot — Marketplace de Pacotes de Treino' }
  }, [anuncio?.titulo])

  async function handleComprar() {
    if (!(await isLoggedIn())) {
      navigate(`/login?next=/anuncio/${anuncioId}`)
      return
    }
    setBuying(true)
    try {
      const pedido = await lojaApi.criarPedido(anuncioId)
      if (pedido.modo === 'MP') setPedidoPix(pedido)
      else setPedidoManual(pedido)
    } catch (err) {
      const code = isAxiosError(err) ? err.response?.data?.detail?.code : undefined
      if (code === 'JA_COMPRADO') {
        toast.show('Você já comprou este pacote — veja em Minhas compras.', 'info')
        navigate('/compras')
      } else if (code === 'COMPRA_PROPRIA') {
        toast.show('Este anúncio é seu — não é possível comprar o próprio pacote.', 'info')
      } else if (isAxiosError(err) && err.response?.status === 401) {
        navigate(`/login?next=/anuncio/${anuncioId}`)
      } else {
        toast.show('Não foi possível iniciar a compra. Tente novamente.', 'error')
      }
    } finally {
      setBuying(false)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-24"><Spinner /></div>
  }
  if (isError || !anuncio) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <p className="text-sm text-text-secondary">Anúncio não encontrado ou não está mais disponível.</p>
        <Link to="/" className="text-accent text-sm hover:underline">Voltar ao catálogo</Link>
      </div>
    )
  }

  const s = anuncio.stats || { n_exercicios: 0, n_templates: 0, n_rotinas: 0 }
  const avaliacoes = avaliacoesData?.avaliacoes ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text mb-4">
        <ArrowLeft size={16} /> Catálogo
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conteúdo */}
        <div className="lg:col-span-2 space-y-6">
          {anuncio.capa_url ? (
            <img src={anuncio.capa_url} alt={anuncio.titulo} className="w-full aspect-video object-cover rounded-2xl border border-border" />
          ) : (
            <div className="w-full aspect-video rounded-2xl border border-border bg-gradient-to-br from-accent/25 via-surface to-surface flex items-center justify-center">
              <Dumbbell size={56} className="text-accent/50" />
            </div>
          )}

          <div>
            <h1 className="text-2xl font-bold text-text" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>
              {anuncio.titulo}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
              <span>por <span className="text-text font-medium">{anuncio.vendedor_nome || 'Personal Trainer'}</span></span>
              <StarRating media={anuncio.avaliacao_media} count={anuncio.avaliacao_count} />
              {anuncio.vendas_count > 0 && <span className="text-xs text-text-muted">{anuncio.vendas_count} venda{anuncio.vendas_count === 1 ? '' : 's'}</span>}
            </div>
          </div>

          <Card className="p-5">
            <h2 className="font-semibold text-text mb-2">Sobre este pacote</h2>
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{anuncio.descricao}</p>
          </Card>

          {/* Avaliações */}
          <Card className="p-5">
            <h2 className="font-semibold text-text mb-3">Avaliações de compradores</h2>
            {avaliacoes.length === 0 ? (
              <p className="text-sm text-text-muted">Ainda não há avaliações — seja o primeiro a comprar e avaliar.</p>
            ) : (
              <ul className="space-y-4">
                {avaliacoes.map((a) => (
                  <li key={a.comprador_id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text">{a.comprador_nome || 'Comprador'}</span>
                      <StarRating media={a.nota} count={1} />
                    </div>
                    {a.comentario && (
                      <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap">{a.comentario}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Card de compra */}
        <div className="lg:col-span-1">
          <Card className="p-5 space-y-4 lg:sticky lg:top-20">
            <p className="text-3xl font-bold text-text" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>
              {formatPreco(anuncio.preco_centavos)}
            </p>

            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <Repeat size={15} className="text-accent shrink-0" />
                {s.n_rotinas} rotina{s.n_rotinas === 1 ? '' : 's'} completa{s.n_rotinas === 1 ? '' : 's'}
              </li>
              <li className="flex items-center gap-2">
                <Dumbbell size={15} className="text-accent shrink-0" />
                {s.n_templates} treino{s.n_templates === 1 ? '' : 's'} (template{s.n_templates === 1 ? '' : 's'})
              </li>
              <li className="flex items-center gap-2">
                <Layers size={15} className="text-accent shrink-0" />
                {s.n_exercicios} exercício{s.n_exercicios === 1 ? '' : 's'} com orientações
              </li>
            </ul>

            <div className="rounded-xl bg-surface border border-border p-3 space-y-2 text-xs text-text-secondary">
              {anuncio.mp_disponivel ? (
                <p className="flex items-start gap-2">
                  <Zap size={14} className="text-success shrink-0 mt-0.5" />
                  Pagamento via PIX com liberação imediata do pacote.
                </p>
              ) : (
                <p className="flex items-start gap-2">
                  <HandCoins size={14} className="text-warning shrink-0 mt-0.5" />
                  Pagamento combinado direto com o vendedor. O pacote é liberado quando ele confirmar o recebimento.
                </p>
              )}
              <p className="flex items-start gap-2">
                <ShieldCheck size={14} className="text-accent shrink-0 mt-0.5" />
                Licença de uso individual — instalação direta na sua conta CoachPilot.
              </p>
            </div>

            <Button
              className="w-full border-0"
              size="lg"
              onClick={handleComprar}
              disabled={buying}
              style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', boxShadow: '0 8px 25px rgba(20,184,166,0.3)' }}
            >
              {buying ? 'Processando…' : 'Comprar agora'}
            </Button>
            <p className="text-[11px] text-text-muted text-center">
              É preciso ter uma conta CoachPilot (grátis) para comprar e instalar.
            </p>
          </Card>
        </div>
      </div>

      {pedidoPix && (
        <CheckoutPixModal pedido={pedidoPix} onClose={() => setPedidoPix(null)} />
      )}

      {pedidoManual && (
        <Modal open title="Pedido enviado ao vendedor!" onClose={() => setPedidoManual(null)}>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              O vendedor foi notificado do seu interesse em{' '}
              <span className="font-semibold text-text">"{pedidoManual.titulo}"</span>{' '}
              ({formatPreco(pedidoManual.preco_centavos)}). Combine o pagamento diretamente com ele —
              assim que ele confirmar o recebimento, o pacote será liberado e você receberá uma notificação.
            </p>
            <p className="text-xs text-text-muted">
              Acompanhe o status em <Link to="/compras" className="text-accent hover:underline">Minhas compras</Link>.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPedidoManual(null)}>Fechar</Button>
              <Button onClick={() => navigate('/compras')}>Minhas compras</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
