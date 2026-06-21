import { useState } from 'react'
import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, ChevronDown, Newspaper, Lightbulb, AlertCircle, MoreHorizontal, BookOpen } from 'lucide-react'
import { alunoApi, type PostGlobal } from '../../api/alunoApp'
import { renderMarkdownLite } from '../chat/markdownLite'
import { Avatar, Badge, Spinner, EmptyState } from '../ui'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'
const TIPO_META: Record<PostGlobal['tipo'], { label: string; icon: React.ReactNode; tone: Tone }> = {
  ARTIGO:    { label: 'Artigo',             icon: <Newspaper size={12} />,      tone: 'accent' },
  DICA:      { label: 'Dica',               icon: <Lightbulb size={12} />,      tone: 'success' },
  MOTIVACAO: { label: 'Motivação',          icon: <Heart size={12} />,          tone: 'info' },
  AVISO:     { label: 'Aviso',              icon: <AlertCircle size={12} />,    tone: 'warning' },
  RECURSO:   { label: 'Recurso Educacional', icon: <BookOpen size={12} />,      tone: 'accent' },
  OUTRO:     { label: 'Post',               icon: <MoreHorizontal size={12} />, tone: 'neutral' },
}

function PostCard({ post, personalNome, personalFotoUrl }: { post: PostGlobal; personalNome?: string; personalFotoUrl?: string }) {
  const qc = useQueryClient()
  const meta = TIPO_META[post.tipo] ?? TIPO_META.OUTRO
  const [curtido, setCurtido] = useState(post.curtido_por_mim)
  const [totalCurtidas, setTotalCurtidas] = useState(post.total_curtidas)

  const curtir = useMutation({
    mutationFn: () => alunoApi.curtirFeed(post.post_sk),
    onSuccess: (data) => {
      setCurtido(data.curtido)
      setTotalCurtidas((n) => n + (data.curtido ? 1 : -1))
      qc.invalidateQueries({ queryKey: ['aluno-feed-global'] })
    },
  })

  const fmtData = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-surface-elevated rounded-2xl p-4 space-y-3 border border-border">
      <div className="flex items-center gap-2">
        <Avatar name={personalNome ?? 'Personal'} imageUrl={personalFotoUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text truncate">{personalNome ?? 'Personal'}</p>
          <p className="text-[10px] text-text-muted">{fmtData(post.data_hora)}</p>
        </div>
        <Badge tone={meta.tone}>
          <span className="flex items-center gap-1">{meta.icon}{meta.label}</span>
        </Badge>
      </div>

      <div className="text-sm text-text-primary leading-relaxed">
        {renderMarkdownLite(post.texto)}
      </div>

      {(post.midias ?? []).length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {post.midias.map((m, i) => (
            m.tipo.includes('video') || m.tipo.includes('audio') ? (
              m.tipo.includes('audio') ? (
                <audio key={i} controls preload="none" src={m.url} className="col-span-2 w-full rounded-lg" />
              ) : (
                <video key={i} controls preload="none" src={m.url} className="col-span-2 w-full rounded-xl max-h-64 object-cover" />
              )
            ) : (
              <a key={i} href={m.url} target="_blank" rel="noreferrer">
                <img src={m.url} alt="mídia" loading="lazy" className="w-full rounded-xl object-cover aspect-square" />
              </a>
            )
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => curtir.mutate()}
          disabled={curtir.isPending}
          className={`flex items-center gap-1.5 text-sm transition-colors ${curtido ? 'text-red-400' : 'text-text-muted hover:text-red-400'}`}
        >
          <Heart size={16} fill={curtido ? 'currentColor' : 'none'} />
          {totalCurtidas > 0 && <span>{totalCurtidas}</span>}
        </button>
      </div>
    </div>
  )
}

export function FeedGlobalTab() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['aluno-feed-global'],
    queryFn: ({ pageParam }) => alunoApi.feedGlobal({ cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })

  const personalProfile = useQuery({
    queryKey: ['aluno-personal-profile'],
    queryFn: alunoApi.personalProfile,
    staleTime: 300_000,
  })

  const posts = data?.pages.flatMap((p) => p.items) ?? []

  if (isLoading) return <div className="flex justify-center pt-8"><Spinner /></div>

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={<Newspaper size={32} />}
        title="Nenhum post ainda"
        description="Seu personal ainda não publicou nada no feed."
      />
    )
  }

  return (
    <div className="space-y-3 pb-4">
      {posts.map((post) => (
        <PostCard
          key={post.post_id}
          post={post}
          personalNome={personalProfile.data?.nome}
          personalFotoUrl={personalProfile.data?.foto_url}
        />
      ))}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          {isFetchingNextPage ? <Spinner /> : <><ChevronDown size={16} />Ver mais</>}
        </button>
      )}
    </div>
  )
}
