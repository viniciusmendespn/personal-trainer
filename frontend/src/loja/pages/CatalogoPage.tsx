import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Dumbbell, Package } from 'lucide-react'
import { lojaApi, formatPreco, type AnuncioCard } from '../../api/loja'
import { Button, Spinner, EmptyState } from '../../components/ui'
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

function AnuncioCardView({ anuncio }: { anuncio: AnuncioCard }) {
  const s = anuncio.stats || { n_exercicios: 0, n_templates: 0, n_rotinas: 0 }
  return (
    <Link
      to={`/anuncio/${anuncio.anuncio_id}`}
      className="group rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/60 hover:shadow-[var(--shadow-card)] transition-all"
    >
      <Capa anuncio={anuncio} />
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-text leading-snug line-clamp-2 group-hover:text-accent transition-colors">
          {anuncio.titulo}
        </h3>
        <p className="text-xs text-text-muted">por {anuncio.vendedor_nome || 'Personal Trainer'}</p>
        <StarRating media={anuncio.avaliacao_media} count={anuncio.avaliacao_count} />
        <p className="text-xs text-text-secondary">
          {s.n_rotinas} rotina{s.n_rotinas === 1 ? '' : 's'} · {s.n_templates} treino{s.n_templates === 1 ? '' : 's'} · {s.n_exercicios} exercício{s.n_exercicios === 1 ? '' : 's'}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-lg font-bold text-text">{formatPreco(anuncio.preco_centavos)}</span>
          {anuncio.vendas_count > 0 && (
            <span className="text-xs text-text-muted">{anuncio.vendas_count} venda{anuncio.vendas_count === 1 ? '' : 's'}</span>
          )}
        </div>
      </div>
    </Link>
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

  const anuncios = data?.pages.flatMap((p) => p.anuncios) ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-text" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>
          Pacotes de treino de quem entende
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
          Métodos completos — rotinas, treinos e exercícios — criados por personal trainers.
          Compre, instale na sua conta CoachPilot e aplique nos seus alunos.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16"><Spinner /></div>
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
  )
}
