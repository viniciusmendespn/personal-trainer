import { useId, useMemo, useState } from 'react'
import { Plus, Trash2, Video, Pencil, BookOpen, Search, Upload } from 'lucide-react'
import { useBiblioteca, useCreateExLib, useUpdateExLib, useDeleteExLib } from '../hooks/useDominio'
import { Button, Card, Input, Textarea, Spinner, EmptyState, Modal, useConfirm } from '../components/ui'
import { ImportarExerciciosModal } from '../components/ImportarExerciciosModal'
import { LinksUteisIncluirSelector } from '../components/exercicios/LinksUteisIncluirSelector'
import type { ExLibCreate } from '../api/biblioteca'
import type { ExLib } from '../types'

export function BibliotecaPage() {
  const { data: exs, isLoading } = useBiblioteca()
  const create = useCreateExLib()
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [query, setQuery] = useState('')

  const grupos = useMemo(
    () => Array.from(new Set((exs ?? []).map((e) => e.grupo).filter((g): g is string => !!g))).sort(),
    [exs]
  )

  async function addExLib(body: ExLibCreate) {
    await create.mutateAsync(body)
    setShowAdd(false)
  }

  const filtered = useMemo(() => {
    if (!exs) return exs
    const q = query.trim().toLowerCase()
    if (!q) return exs
    return exs.filter((ex) => ex.nome.toLowerCase().includes(q) || ex.grupo?.toLowerCase().includes(q))
  }, [exs, query])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-display text-xl font-semibold">Biblioteca de exercícios</h2>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowImport(true)}><span className="flex items-center gap-1"><Upload size={16} /> Importar</span></Button>
          <Button onClick={() => setShowAdd(true)}><span className="flex items-center gap-1"><Plus size={16} /> Adicionar</span></Button>
        </div>
      </div>
      <p className="text-sm text-text-secondary mb-4">Catálogo reutilizável com vídeo e recomendações (o agente usa nas respostas).</p>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Novo exercício" size="lg">
        <ExLibForm grupos={grupos} submitLabel="Adicionar" submitting={create.isPending} onSubmit={addExLib} />
      </Modal>

      <ImportarExerciciosModal open={showImport} onClose={() => setShowImport(false)} />

      {isLoading ? (
        <Spinner />
      ) : !exs?.length ? (
        <EmptyState icon={<BookOpen />} title="Catálogo vazio" description='Use o botão "Adicionar" para cadastrar o primeiro exercício.' />
      ) : (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input placeholder="Buscar por nome ou grupo…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered?.map((ex) => <ExLibRow key={ex.exlib_id} ex={ex} grupos={grupos} />)}
          </div>
        </>
      )}
    </div>
  )
}

function ExLibForm({
  initial, grupos, onSubmit, submitting, submitLabel,
}: {
  initial?: Partial<ExLib>
  grupos: string[]
  onSubmit: (body: ExLibCreate) => Promise<void>
  submitting?: boolean
  submitLabel: string
}) {
  const listId = useId()
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [grupo, setGrupo] = useState(initial?.grupo ?? '')
  const [video, setVideo] = useState(initial?.video_url ?? '')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [rec, setRec] = useState(initial?.recomendacoes ?? '')
  const [linksUteis, setLinksUteis] = useState<string[]>(initial?.links_uteis ?? [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome) return
    await onSubmit({
      nome, grupo: grupo || undefined, video_url: video || undefined,
      descricao: descricao || undefined, recomendacoes: rec || undefined,
      links_uteis: linksUteis,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        <Input label="Grupo muscular" list={listId} value={grupo} onChange={(e) => setGrupo(e.target.value)} />
        <datalist id={listId}>{grupos.map((g) => <option key={g} value={g} />)}</datalist>
      </div>
      <Input label="Vídeo (URL)" value={video} onChange={(e) => setVideo(e.target.value)} />
      <Textarea label="Descrição" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <Textarea label="Recomendações (técnica, cuidados, dicas…)" rows={3} value={rec} onChange={(e) => setRec(e.target.value)} />
      <LinksUteisIncluirSelector value={linksUteis} onChange={setLinksUteis} />
      <Button type="submit" className="w-full" disabled={submitting || !nome}>
        {submitting ? 'Salvando…' : submitLabel}
      </Button>
    </form>
  )
}

function ExLibRow({ ex, grupos }: { ex: ExLib; grupos: string[] }) {
  const [edit, setEdit] = useState(false)
  const upd = useUpdateExLib()
  const del = useDeleteExLib()
  const confirm = useConfirm()

  async function save(body: ExLibCreate) {
    await upd.mutateAsync({ id: ex.exlib_id, body })
    setEdit(false)
  }

  async function remove() {
    const ok = await confirm({
      title: 'Remover da biblioteca',
      message: `Remover "${ex.nome}" do catálogo? Treinos que já usam esse exercício não são afetados.`,
      confirmLabel: 'Remover', tone: 'danger',
    })
    if (ok) del.mutate(ex.exlib_id)
  }

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
        <Button variant="ghost" size="sm" iconOnly aria-label="Remover" onClick={remove} className="hover:text-danger"><Trash2 size={15} /></Button>
      </span>

      <Modal open={edit} onClose={() => setEdit(false)} title="Editar exercício" size="lg">
        <ExLibForm initial={ex} grupos={grupos} submitLabel="Salvar" submitting={upd.isPending} onSubmit={save} />
      </Modal>
    </Card>
  )
}
