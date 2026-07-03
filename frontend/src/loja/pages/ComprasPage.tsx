import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingBag, Star } from 'lucide-react'
import { lojaApi, precoLabel, type Pedido, type PedidoStatus } from '../../api/loja'
import { Badge, Button, Card, Modal, Spinner, Textarea, EmptyState, useToast } from '../../components/ui'
import { StarPicker } from '../StarRating'
import { CheckoutPixModal } from '../CheckoutPixModal'
import { InstalarActions } from '../InstalarActions'
import { useLojaAuthContext } from '../LojaApp'

const STATUS_LABEL: Record<PedidoStatus, { label: string; tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral' }> = {
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando pagamento', tone: 'warning' },
  AGUARDANDO_VENDEDOR: { label: 'Aguardando o vendedor confirmar', tone: 'info' },
  ENTREGUE: { label: 'Liberado', tone: 'success' },
  EXPIRADO: { label: 'Expirado', tone: 'neutral' },
  CANCELADO: { label: 'Cancelado', tone: 'neutral' },
}

function AvaliarModal({ pedido, onClose }: { pedido: Pedido; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [nota, setNota] = useState(5)
  const [comentario, setComentario] = useState('')
  const [saving, setSaving] = useState(false)

  async function handle() {
    setSaving(true)
    try {
      await lojaApi.avaliar(pedido.anuncio_id, nota, comentario.trim())
      toast.show('Avaliação enviada — obrigado!', 'success')
      qc.invalidateQueries({ queryKey: ['loja-avaliacoes', pedido.anuncio_id] })
      qc.invalidateQueries({ queryKey: ['loja-anuncio', pedido.anuncio_id] })
      onClose()
    } catch {
      toast.show('Não foi possível enviar a avaliação.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={`Avaliar "${pedido.titulo}"`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-text-secondary">Qual sua nota para este pacote?</p>
          <StarPicker value={nota} onChange={setNota} />
        </div>
        <Textarea
          label="Comentário (opcional)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Conte como o método funcionou para você e seus alunos…"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handle} disabled={saving}>{saving ? 'Enviando…' : 'Enviar avaliação'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function CompraCard({ pedido, onRefresh }: { pedido: Pedido; onRefresh: () => void }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [pixPedido, setPixPedido] = useState<Pedido | null>(null)
  const [avaliar, setAvaliar] = useState(false)
  const [working, setWorking] = useState(false)
  const st = STATUS_LABEL[pedido.status] ?? { label: pedido.status, tone: 'neutral' as const }

  async function continuarPagamento() {
    setWorking(true)
    try {
      const p = await lojaApi.getPedido(pedido.pedido_id)
      if (p.status === 'AGUARDANDO_PAGAMENTO') setPixPedido(p)
      else onRefresh()
    } catch {
      toast.show('Não foi possível retomar o pagamento.', 'error')
    } finally {
      setWorking(false)
    }
  }

  async function cancelar() {
    setWorking(true)
    try {
      await lojaApi.cancelarPedido(pedido.pedido_id)
      toast.show('Pedido cancelado.', 'info')
      onRefresh()
    } catch {
      toast.show('Não foi possível cancelar o pedido.', 'error')
    } finally {
      setWorking(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="min-w-0">
          <Link to={`/anuncio/${pedido.anuncio_id}`} className="font-semibold text-text hover:text-accent line-clamp-1">
            {pedido.titulo}
          </Link>
          <p className="text-xs text-text-muted mt-0.5">
            {precoLabel(pedido.preco_centavos)} · vendedor: {pedido.vendedor_nome || 'Personal'} ·{' '}
            {new Date(pedido.criado_em).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pedido.status === 'AGUARDANDO_PAGAMENTO' && (
          <>
            <Button size="sm" onClick={continuarPagamento} disabled={working}>Continuar pagamento</Button>
            <Button size="sm" variant="ghost" onClick={cancelar} disabled={working}>Cancelar</Button>
          </>
        )}
        {pedido.status === 'AGUARDANDO_VENDEDOR' && (
          <>
            <p className="text-xs text-text-secondary w-full">
              Combine o pagamento com o vendedor — o pacote é liberado assim que ele confirmar o recebimento.
            </p>
            <Button size="sm" variant="ghost" onClick={cancelar} disabled={working}>Cancelar pedido</Button>
          </>
        )}
        {pedido.status === 'ENTREGUE' && (
          <>
            <InstalarActions pedidoId={pedido.pedido_id} compact />
            <Button size="sm" variant="outline" onClick={() => setAvaliar(true)}>
              <Star size={14} className="mr-1" /> Avaliar
            </Button>
          </>
        )}
        {(pedido.status === 'EXPIRADO' || pedido.status === 'CANCELADO') && (
          <Button size="sm" variant="outline" onClick={() => navigate(`/anuncio/${pedido.anuncio_id}`)}>
            Comprar novamente
          </Button>
        )}
      </div>

      {pixPedido && (
        <CheckoutPixModal pedido={pixPedido} onClose={() => { setPixPedido(null); onRefresh() }} />
      )}
      {avaliar && <AvaliarModal pedido={pedido} onClose={() => setAvaliar(false)} />}
    </Card>
  )
}

export function ComprasPage() {
  const { user, loading } = useLojaAuthContext()
  const navigate = useNavigate()
  const qc = useQueryClient()

  useEffect(() => {
    if (!loading && !user) navigate('/login?next=/compras', { replace: true })
  }, [loading, user, navigate])

  useEffect(() => {
    document.title = 'Minhas compras — Loja CoachPilot'
    return () => { document.title = 'Loja CoachPilot — Marketplace de Pacotes de Treino' }
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['loja-compras'],
    queryFn: () => lojaApi.minhasCompras(),
    enabled: !!user,
  })

  const compras = data?.compras ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold text-text mb-6" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>
        Minhas compras
      </h1>

      {(loading || isLoading) && <div className="flex justify-center py-16"><Spinner /></div>}

      {!isLoading && user && compras.length === 0 && (
        <EmptyState
          icon={<ShoppingBag />}
          title="Você ainda não comprou nenhum pacote"
          description="Explore o catálogo e encontre métodos prontos para aplicar nos seus alunos."
          action={<Button onClick={() => navigate('/')}>Ver catálogo</Button>}
        />
      )}

      <div className="space-y-3">
        {compras.map((p) => (
          <CompraCard
            key={p.pedido_id}
            pedido={p}
            onRefresh={() => qc.invalidateQueries({ queryKey: ['loja-compras'] })}
          />
        ))}
      </div>
    </div>
  )
}
