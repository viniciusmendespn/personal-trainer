import { useMemo, useState } from 'react'
import { Plus, Trash2, Video, Pencil, Check, X, BookOpen, Search } from 'lucide-react'
import { useBiblioteca, useCreateExLib, useUpdateExLib, useDeleteExLib } from '../hooks/useDominio'
import { Button, Card, Input, Textarea, Spinner, EmptyState } from '../components/ui'
import type { ExLib } from '../types'

export function BibliotecaPage() {
  const { data: exs, isLoading } = useBiblioteca()
  const create = useCreateExLib()
  const [nome, setNome] = useState('')
  const [grupo, setGrupo] = useState('')
  const [video, setVideo] = useState('')
  const [rec, setRec] = useState('')
  const [query, setQuery] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome) return
    await create.mutateAsync({ nome, grupo: grupo || undefined, video_url: video || undefined, recomendacoes: rec || undefined })
    setNome(''); setGrupo(''); setVideo(''); setRec('')
  }

  const filtered = useMemo(() => {
    if (!exs) return exs
    const q = query.trim().toLowerCase()
    if (!q) return exs
    return exs.filter((ex) => ex.nome.toLowerCase().includes(q) || ex.grupo?.toLowerCase().includes(q))
  }, [exs, query])

  const grupos = useMemo(
    () => Array.from(new Set((exs ?? []).map((e) => e.grupo).filter((g): g is string => !!g))).sort(),
    [exs]
  )

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="font-display text-xl font-semibold mb-1">Biblioteca de exercícios</h2>
      <p className="text-sm text-text-secondary mb-4">Catálogo reutilizável com vídeo e recomendações (o agente usa nas respostas).</p>

      <Card variant="elevated" className="mb-6">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input label="Grupo" list="grupos-biblioteca" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
            <Input label="Vídeo (URL)" value={video} onChange={(e) => setVideo(e.target.value)} />
          </div>
          <datalist id="grupos-biblioteca">
            {grupos.map((g) => <option key={g} value={g} />)}
          </datalist>
          <Textarea rows={2} placeholder="Recomendações (técnica, cuidados, dicas…)" value={rec} onChange={(e) => setRec(e.target.value)} />
          <Button type="submit" disabled={create.isPending}><span className="flex items-center gap-1"><Plus size={16} /> Adicionar</span></Button>
        </form>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !exs?.length ? (
        <EmptyState icon={<BookOpen />} title="Catálogo vazio" description="Adicione exercícios no formulário acima." />
      ) : (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input placeholder="Buscar por nome ou grupo…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered?.map((ex) => <ExLibRow key={ex.exlib_id} ex={ex} />)}
          </div>
        </>
      )}
    </div>
  )
}

function ExLibRow({ ex }: { ex: ExLib }) {
  const [edit, setEdit] = useState(false)
  const upd = useUpdateExLib()
  const del = useDeleteExLib()
  const [nome, setNome] = useState(ex.nome)
  const [grupo, setGrupo] = useState(ex.grupo ?? '')
  const [video, setVideo] = useState(ex.video_url ?? '')
  const [rec, setRec] = useState(ex.recomendacoes ?? '')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await upd.mutateAsync({ id: ex.exlib_id, body: { nome, grupo: grupo || undefined, video_url: video || undefined, recomendacoes: rec || undefined } })
    setEdit(false)
  }

  if (edit)
    return (
      <Card variant="elevated" className="sm:col-span-2">
        <form onSubmit={save} className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input value={grupo} list="grupos-biblioteca" onChange={(e) => setGrupo(e.target.value)} placeholder="Grupo" />
            <Input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="Vídeo" />
          </div>
          <Textarea rows={2} placeholder="Recomendações" value={rec} onChange={(e) => setRec(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={upd.isPending}><Check size={16} /></Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEdit(false)}><X size={16} /></Button>
          </div>
        </form>
      </Card>
    )

  return (
    <Card variant="elevated" className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="font-medium truncate">{ex.nome} {ex.grupo && <span className="text-xs text-text-muted">· {ex.grupo}</span>}</p>
        {ex.video_url && (
          <a href={ex.video_url} target="_blank" rel="noreferrer" className="text-xs text-accent-hover inline-flex items-center gap-1 hover:underline">
            <Video size={12} /> vídeo
          </a>
        )}
        {ex.recomendacoes && <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap">{ex.recomendacoes}</p>}
      </div>
      <span className="flex gap-2 shrink-0">
        <Button variant="ghost" size="sm" iconOnly aria-label="Editar" onClick={() => setEdit(true)}><Pencil size={15} /></Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Remover" onClick={() => del.mutate(ex.exlib_id)} className="hover:text-danger"><Trash2 size={15} /></Button>
      </span>
    </Card>
  )
}
