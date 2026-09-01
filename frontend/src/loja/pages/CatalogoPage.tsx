import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Dumbbell, Layers, Package, Repeat, Store } from 'lucide-react'
import { lojaApi, precoLabel, type AnuncioCard } from '../../api/loja'
import { Button, EmptyState } from '../../components/ui'
import { StarRating } from '../StarRating'

function Capa({ anuncio }: { anuncio: AnuncioCard }) {
  if (anuncio.capa_url) {
    return (
      <img
        src={anuncio.capa_url}
        alt={anuncio.titulo}
        className="w-full aspect-video object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <div className="w-full aspect-video bg-gradient-to-br from-accent/25 via-surface to-surface flex items-center justify-center">
      <Dumbbell size={40} className="text-accent/50" />
    </div>
  )
}

function StatPill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-text-secondary">
      {icon}
      {children}
    </span>
  )
}

function AnuncioCardView({ anuncio }: { anuncio: AnuncioCard }) {
  const s = anuncio.stats || { n_exercicios: 0, n_templates: 0, n_rotinas: 0 }
  const gratis = anuncio.preco_centavos === 0
  return (
    <Link
      to={`/anuncio/${anuncio.anuncio_id}`}
      className="group rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/60 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 transition-all"
    >
      <div className="relative">
        <Capa anuncio={anuncio} />
        {gratis && (
          <span className="absolute top-2 left-2 rounded-full bg-success px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow">
            Grátis
          </span>
        )}
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-text leading-snug line-clamp-2 group-hover:text-accent transition-colors">
          {anuncio.titulo}
        </h3>
        <p className="text-xs text-text-muted">por {anuncio.vendedor_nome || 'Personal Trainer'}</p>
        <StarRating media={anuncio.avaliacao_media} count={anuncio.avaliacao_count} />
        <div className="flex flex-wrap gap-1.5">
          <StatPill icon={<Repeat size={11} className="text-accent" />}>
            {s.n_rotinas} rotina{s.n_rotinas === 1 ? '' : 's'}
          </StatPill>
          <StatPill icon={<Dumbbell size={11} className="text-accent" />}>
            {s.n_templates} treino{s.n_templates === 1 ? '' : 's'}
          </StatPill>
          <StatPill icon={<Layers size={11} className="text-accent" />}>
            {s.n_exercicios} exercício{s.n_exercicios === 1 ? '' : 's'}
          </StatPill>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className={`text-lg font-bold ${gratis ? 'text-success' : 'text-accent'}`} style={{ fontFamily: 'Sora, Inter, sans-serif' }}>
            {precoLabel(anuncio.preco_centavos)}
          </span>
          {anuncio.vendas_count > 0 && (
            <span className="text-xs text-text-muted">
              {anuncio.vendas_count} {gratis ? 'resgate' : 'venda'}{anuncio.vendas_count === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden animate-pulse">
      <div className="w-full aspect-video bg-surface-elevated" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-surface-elevated" />
        <div className="h-3 w-1/2 rounded bg-surface-elevated" />
        <div className="h-3 w-2/3 rounded bg-surface-elevated" />
        <div className="h-5 w-24 rounded bg-surface-elevated" />
      </div>
    </div>
  )
}

export function CatalogoPage() {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['loja-catalogo'],
      queryFn: ({ pageParam }) => lojaApi.catalogo(pageParam),
      initialPageParam: null as string | null,
      getNextPageParam: (last) => last.cursor,
    })

  const anuncios = data?.pages.flatMap((p) => p.anuncios ?? []) ?? []

  return (
    <div className="relative">
      <div aria-hidden className="loja-dots pointer-events-none absolute inset-x-0 top-0 h-72 opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-72 w-[560px] max-w-full rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.14), transparent 70%)', filter: 'blur(32px)' }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-10">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5">
            <Store size={13} className="text-accent" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Marketplace · pacotes criados por personais
            </span>
          </div>
          <h1
            className="mx-auto max-w-3xl text-3xl sm:text-4xl font-extrabold text-text leading-tight"
            style={{ fontFamily: 'Sora, Inter, sans-serif', letterSpacing: '-0.5px' }}
          >
            Pacotes de treino <span className="loja-gradient-text">de quem entende</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-text-secondary">
            Métodos completos — rotinas, treinos e exercícios — criados por personal trainers.
            Compre, instale na sua conta CoachPilot e aplique nos seus alunos.
          </p>
        </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-center text-sm text-danger py-16">
          Não foi possível carregar o catálogo. Tente novamente em instantes.
        </p>
      )}

      {!isLoading && !isError && anuncios.length === 0 && (
        <EmptyState
          icon={<Package />}
          title="Nenhum pacote anunciado ainda"
          description="Em breve os primeiros métodos estarão disponíveis aqui."
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {anuncios.map((a) => (
          <AnuncioCardView key={a.anuncio_id} anuncio={a} />
        ))}
      </div>

      {hasNextPage && (
        <div className="flex justify-center mt-8">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
          </Button>
        </div>
      )}
      </div>
    </div>
  )
}
