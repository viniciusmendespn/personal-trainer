import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Search,
  Download,
  SlidersHorizontal,
  Layers,
  Package,
  Repeat,
  Dumbbell,
} from 'lucide-react'
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
    <div className="loja-cover-fallback">
      <img
        src="/images/coachpilot-training-v2.webp"
        alt=""
        width="1536"
        height="1024"
        loading="lazy"
      />
      <span>Imagem ilustrativa</span>
    </div>
  )
}

function StatPill({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
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
      className="loja-product group rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/60 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 transition-all"
    >
      <div className="relative">
        <Capa anuncio={anuncio} />
        {gratis && (
          <span className="absolute top-2 left-2 rounded-full bg-success px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow">
            Grátis
          </span>
        )}
      </div>
      <div className="loja-product-body p-4 space-y-2">
        <h3 className="font-semibold text-text leading-snug line-clamp-2 group-hover:text-accent transition-colors">
          {anuncio.titulo}
        </h3>
        <p className="text-xs text-text-secondary">
          por {anuncio.vendedor_nome || 'Personal Trainer'}
        </p>
        <StarRating
          media={anuncio.avaliacao_media}
          count={anuncio.avaliacao_count}
        />
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
          <span
            className={`text-lg font-bold ${gratis ? 'text-success' : 'text-accent'}`}
            style={{ fontFamily: 'Sora, Inter, sans-serif' }}
          >
            {precoLabel(anuncio.preco_centavos)}
          </span>
          {anuncio.vendas_count > 0 && (
            <span className="text-xs text-text-muted">
              {anuncio.vendas_count} {gratis ? 'resgate' : 'venda'}
              {anuncio.vendas_count === 1 ? '' : 's'}
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
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [sort, setSort] = useState('default')
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['loja-catalogo'],
    queryFn: ({ pageParam }) => lojaApi.catalogo(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
  })
  const anuncios = data?.pages.flatMap((page) => page.anuncios ?? []) ?? []
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
  const filtered = anuncios.filter(
    (item) =>
      (filter === 'Todos' ||
        (filter === 'Gratuitos'
          ? item.preco_centavos === 0
          : item.preco_centavos > 0)) &&
      normalize(item.titulo + ' ' + (item.vendedor_nome ?? '')).includes(
        normalize(search),
      ),
  )
  const shown = [...filtered].sort((a, b) =>
    sort === 'price-asc'
      ? a.preco_centavos - b.preco_centavos
      : sort === 'price-desc'
        ? b.preco_centavos - a.preco_centavos
        : 0,
  )
  return (
    <div>
      <section className="loja-hero">
        <div className="cp-container loja-hero-grid">
          <div>
            <p className="cp-eyebrow">Loja CoachPilot</p>
            <h1>
              Métodos de quem
              <br />
              vive o treino.
              <br />
              <em>Inspire seu próximo.</em>
            </h1>
            <p>
              Pacotes criados por personal trainers, com rotinas, treinos e
              exercícios. Encontre novas ideias e leve o conhecimento de outros
              profissionais para a sua prática.
            </p>
            <div className="cp-actions">
              <a className="cp-button" href="#catalogo">
                Explorar os pacotes <ArrowRight size={16} />
              </a>
              <a
                className="cp-button cp-button-outline"
                href="https://coachpilot.com.br/loja-vendas"
              >
                Quero vender meus métodos
              </a>
            </div>
            <p className="loja-hero-note">
              Feito para profissionais. Integrado ao seu CoachPilot.
            </p>
          </div>
          <div className="loja-hero-visual">
            <img
              src="/images/coachpilot-training-v2.webp"
              alt="Treinamento de força com orientação de um personal trainer"
              width="1536"
              height="1024"
              fetchPriority="high"
            />
            <div className="loja-hero-label">
              <Layers size={18} />
              <div>
                <strong>Um pacote. Novas possibilidades.</strong>
                <span>Rotinas + treinos + exercícios</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="loja-benefits">
        <div className="cp-container">
          <span>
            <Layers size={17} /> Pacotes completos de treinamento
          </span>
          <span>
            <Download size={17} /> Instalação na sua conta CoachPilot
          </span>
          <span>
            <Repeat size={17} /> Adapte aos seus alunos
          </span>
        </div>
      </div>
      <section id="catalogo" className="cp-container loja-catalog">
        <div className="cp-section-head">
          <div>
            <p className="cp-eyebrow">Explore o catálogo</p>
            <h2 className="cp-heading">
              Seu próximo treino
              <br />
              começa com uma boa ideia.
            </h2>
          </div>
          <p className="cp-subtitle" style={{ maxWidth: 310, fontSize: 13 }}>
            Conheça cada pacote, veja o que está incluído e escolha o que
            combina com o seu trabalho.
          </p>
        </div>
        <div className="loja-toolbar">
          <label className="loja-search">
            <Search size={18} />
            <input
              type="search"
              aria-label="Buscar pacotes carregados por título ou profissional"
              placeholder="Busque um pacote ou profissional"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="loja-filters" aria-label="Tipo de pacote">
            {['Todos', 'Gratuitos', 'Pagos'].map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                aria-pressed={filter === item}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="loja-sort">
            <SlidersHorizontal size={15} />
            <select
              aria-label="Ordenar pacotes"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="default">Ordem do catálogo</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
            </select>
          </label>
        </div>
        <p className="loja-result-count" role="status">
          {isLoading
            ? 'Carregando os pacotes…'
            : shown.length +
              ' pacote' +
              (shown.length === 1 ? '' : 's') +
              ' encontrado' +
              (shown.length === 1 ? '' : 's')}
          {hasNextPage && !isLoading
            ? ' entre os itens carregados. Carregue mais para ampliar a busca.'
            : ''}
        </p>
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}
        {isError && (
          <div className="loja-empty">
            <Package size={30} />
            <h3>Não foi possível carregar o catálogo.</h3>
            <p>Tente novamente para conferir os pacotes disponíveis.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {!isLoading && !isError && !shown.length && (
          <EmptyState
            icon={<Package />}
            title={
              anuncios.length
                ? 'Nenhum pacote encontrado'
                : 'Novos métodos estão a caminho'
            }
            description={
              anuncios.length
                ? 'Tente outra busca ou mude o filtro de preço.'
                : 'Os pacotes publicados pelos profissionais aparecerão aqui. Volte em breve ou conheça como vender seu método.'
            }
          />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((anuncio) => (
            <AnuncioCardView key={anuncio.anuncio_id} anuncio={anuncio} />
          ))}
        </div>
        {hasNextPage && (
          <div className="flex justify-center mt-8">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Carregando…' : 'Carregar mais pacotes'}
            </Button>
          </div>
        )}
      </section>
      <section className="loja-sell">
        <div className="cp-container cp-final-inner">
          <div>
            <p className="cp-eyebrow">Seu conhecimento tem valor</p>
            <h2 className="cp-heading">
              Seu método pode inspirar
              <br />
              outros profissionais.
            </h2>
            <p>
              Publique seus pacotes e apresente seu trabalho na Loja CoachPilot.
            </p>
          </div>
          <a href="https://coachpilot.com.br/loja-vendas" className="cp-button">
            Quero anunciar meu método <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </div>
  )
}
