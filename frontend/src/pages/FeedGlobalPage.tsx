import { useRef, useState } from 'react'
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Heart, ChevronDown, Paperclip, X, Loader2 } from 'lucide-react'
import { feedGlobalApi, type PostGlobalTipo } from '../api/feedGlobal'
import { renderMarkdownLite } from '../components/chat/markdownLite'
import { Button, Card, Badge, EmptyState, Spinner } from '../components/ui'

const TIPOS: Array<{ value: PostGlobalTipo; label: string; tone: 'accent' | 'success' | 'info' | 'warning' | 'neutral' }> = [
  { value: 'DICA', label: 'Dica', tone: 'success' },
  { value: 'MOTIVACAO', label: 'Motivação', tone: 'info' },
  { value: 'ARTIGO', label: 'Artigo', tone: 'accent' },
  { value: 'AVISO', label: 'Aviso', tone: 'warning' },
  { value: 'RECURSO', label: 'Recurso Educacional', tone: 'accent' },
  { value: 'OUTRO', label: 'Outro', tone: 'neutral' },
]

interface PendingFile { file: File; preview: string; s3_key?: string; tipo?: string }

function Composer({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<PostGlobalTipo>('DICA')
  const [texto, setTexto] = useState('')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function uploadFile(f: File): Promise<{ s3_key: string; tipo: string }> {
    const { upload_url, s3_key } = await feedGlobalApi.uploadUrl(f.name, f.type)
    await fetch(upload_url, { method: 'PUT', body: f, headers: { 'Content-Type': f.type } })
    const midia_tipo = f.type.startsWith('video') ? 'video_feed' : f.type.startsWith('audio') ? 'audio_feed' : 'foto_feed'
    return { s3_key, tipo: midia_tipo }
  }

  function addFiles(flist: FileList | null) {
    if (!flist) return
    Array.from(flist).forEach((f) => {
      const preview = f.type.startsWith('image') ? URL.createObjectURL(f) : ''
      setFiles((prev) => [...prev, { file: f, preview }])
    })
  }

  const criar = useMutation({
    mutationFn: async () => {
      setUploading(true)
      const midias: Array<{ s3_key: string; tipo: string }> = []
      for (const pf of files) {
        const uploaded = await uploadFile(pf.file)
        midias.push(uploaded)
      }
      setUploading(false)
      return feedGlobalApi.criar({ tipo, texto, midias })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed-global-personal'] })
      setTexto('')
      setFiles([])
      onDone()
    },
  })

  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTipo(t.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              tipo === t.value ? 'bg-accent text-white border-accent' : 'border-border text-text-muted hover:border-accent/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') criar.mutate() }}
        placeholder="Escreva sua mensagem para os alunos… (markdown suportado)"
        rows={4}
        className="w-full bg-surface rounded-xl px-3 py-2 text-sm resize-none border border-border focus:border-accent focus:outline-none"
      />

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((pf, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-surface flex items-center justify-center">
              {pf.preview ? (
                <img src={pf.preview} alt="" className="object-cover w-full h-full" />
              ) : (
                <span className="text-xs text-text-muted text-center px-1 leading-tight">{pf.file.name}</span>
              )}
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*" className="hidden"
          onChange={(e) => addFiles(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} className="text-text-muted hover:text-text transition-colors">
          <Paperclip size={16} />
        </button>
        <div className="flex-1" />
        <Button
          variant="primary"
          onClick={() => criar.mutate()}
          disabled={!texto.trim() || criar.isPending || uploading}
        >
          {(criar.isPending || uploading) ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Publicar
        </Button>
      </div>
    </Card>
  )
}

function PostItem({ post, onDelete }: { post: ReturnType<typeof usePosts>['posts'][number]; onDelete: (id: string) => void }) {
  const fmtData = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const tipoMeta = TIPOS.find((t) => t.value === post.tipo) ?? TIPOS[4]

  return (
    <div className="bg-surface-elevated rounded-2xl p-4 space-y-3 border border-border">
      <div className="flex items-center justify-between">
        <Badge tone={tipoMeta.tone}>{tipoMeta.label}</Badge>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">{fmtData(post.data_hora)}</span>
          <button onClick={() => onDelete(post.post_sk)} className="text-text-muted hover:text-danger transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="text-sm text-text-primary leading-relaxed">{renderMarkdownLite(post.texto)}</div>
      {(post.midias ?? []).length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {post.midias.map((m, i) =>
            m.tipo?.includes('video') ? (
              <video key={i} src={m.url} controls className="col-span-3 rounded-lg w-full max-h-48 object-cover" />
            ) : m.tipo?.includes('audio') ? (
              <audio key={i} src={m.url} controls className="col-span-3 w-full rounded-lg" />
            ) : (
              <img key={i} src={m.url} alt="" className="rounded-lg w-full aspect-square object-cover" />
            )
          )}
        </div>
      )}
      <div className="flex items-center gap-1 text-xs text-text-muted">
        <Heart size={12} /> {post.total_curtidas ?? 0} curtida{post.total_curtidas !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

function usePosts() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed-global-personal'],
    queryFn: ({ pageParam }) => feedGlobalApi.list({ cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
  return {
    posts: data?.pages.flatMap((p) => p.items) ?? [],
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  }
}

export function FeedGlobalPage() {
  const qc = useQueryClient()
  const [composing, setComposing] = useState(false)
  const { posts, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePosts()

  const deletar = useMutation({
    mutationFn: feedGlobalApi.deletar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-global-personal'] }),
  })

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">Feed</h1>
        <Button variant="primary" onClick={() => setComposing((v) => !v)}>
          <Plus size={16} />
          {composing ? 'Cancelar' : 'Novo post'}
        </Button>
      </div>

      {composing && <Composer onDone={() => setComposing(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : posts.length === 0 && !composing ? (
        <EmptyState
          icon={<Plus size={32} />}
          title="Nenhum post publicado"
          description="Crie o primeiro post para seus alunos verem no app."
        />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => <PostItem key={p.post_id} post={p} onDelete={(id) => deletar.mutate(id)} />)}
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm text-text-muted hover:text-text transition-colors"
            >
              {isFetchingNextPage ? <Spinner /> : <><ChevronDown size={16} />Ver mais</>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
