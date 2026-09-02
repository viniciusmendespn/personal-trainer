import { useMemo, useState } from 'react'
import { Plus, Trash2, Video, Pencil, BookOpen, Search, Upload } from 'lucide-react'
import { useBiblioteca, useCreateExLib, useUpdateExLib, useDeleteExLib } from '../hooks/useDominio'
import { Button, Card, Input, Textarea, Spinner, EmptyState, Modal, useConfirm, ExpandableText } from '../components/ui'
import { GruposMuscularesInput } from '../components/exercicios/GruposMuscularesInput'
import { gruposDoExercicio, grupoLegado, sugestoesDeGrupo, SEM_GRUPO } from '../utils/grupos'
import { ImportarExerciciosModal } from '../components/ImportarExerciciosModal'
import { LinksUteisIncluirSelector } from '../components/exercicios/LinksUteisIncluirSelector'
import { SubstitutosBibliotecaEditor } from '../components/exercicios/SubstitutosBibliotecaEditor'
import type { ExLibCreate } from '../api/biblioteca'
import type { ExercicioSubstituto, ExLib } from '../types'
import { videoUrlComFallback } from '../utils/video'
import { normalizeText } from '../utils/normalizeText'

export function BibliotecaPage() {
  const { data: exs, isLoading } = useBiblioteca()
  const create = useCreateExLib()
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [query, setQuery] = useState('')

  // Vocabulário canônico + o que este personal já usa (quebrando os compostos legados:
  // "Peito, Tríceps" vira duas sugestões, não uma).
  const grupos = useMemo(
    () => sugestoesDeGrupo((exs ?? []).map((e) => e.grupos?.join(', ') ?? e.grupo)),
    [exs]
  )

  async function addExLib(body: ExLibCreate) {
    await create.mutateAsync(body)
    setShowAdd(false)
  }

  const filtered = useMemo(() => {
    if (!exs) return exs
    const q = normalizeText(query)
    if (!q) return exs
    return exs.filter((ex) =>
      normalizeText(ex.nome).includes(q)
      || gruposDoExercicio(ex).some((g) => normalizeText(g).includes(q)))
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
      <p className="text-sm text-text-secondary mb-4">Catálogo reutilizável com vídeo, substitutos e links úteis — usado como sugestão nos treinos e no app do aluno.</p>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Novo exercício" size="lg">
        <ExLibForm grupos={grupos} biblioteca={exs ?? []} submitLabel="Adicionar" submitting={create.isPending} onSubmit={addExLib} />
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
            {filtered?.map((ex) => <ExLibRow key={ex.exlib_id} ex={ex} grupos={grupos} biblioteca={exs ?? []} />)}
          </div>
        </>
      )}
    </div>
  )
}

function ExLibForm({
  initial, grupos, biblioteca, onSubmit, submitting, submitLabel,
}: {
  initial?: Partial<ExLib>
  grupos: string[]
  biblioteca: ExLib[]
  onSubmit: (body: ExLibCreate) => Promise<void>
  submitting?: boolean
  submitLabel: string
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  // Exercício antigo abre com a string composta já quebrada em chips; o item só muda quando
  // o personal salvar — por escolha dele, não por migração.
  const [gruposSel, setGruposSel] = useState<string[]>(
    () => (initial?.grupos?.length || initial?.grupo) ? gruposDoExercicio(initial) : []
  )
  const [video, setVideo] = useState(initial?.video_url ?? '')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [rec, setRec] = useState(initial?.recomendacoes ?? '')
  const [linksUteis, setLinksUteis] = useState<string[]>(initial?.links_uteis ?? [])
  const [substitutos, setSubstitutos] = useState<ExercicioSubstituto[]>(initial?.substitutos ?? [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome) return
    await onSubmit({
      nome, grupos: gruposSel.length ? gruposSel : undefined, grupo: grupoLegado(gruposSel),
      video_url: video || undefined,
      descricao: descricao || undefined, recomendacoes: rec || undefined,
      links_uteis: linksUteis, substitutos,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        <GruposMuscularesInput value={gruposSel} onChange={setGruposSel} suggestions={grupos} />
      </div>
      <Input label="Vídeo (URL)" value={video} onChange={(e) => setVideo(e.target.value)} />
      <Textarea label="Descrição" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <Textarea label="Recomendações (técnica, cuidados, dicas…)" rows={3} value={rec} onChange={(e) => setRec(e.target.value)} />
      <LinksUteisIncluirSelector value={linksUteis} onChange={setLinksUteis} />
      <SubstitutosBibliotecaEditor exercicioNome={nome} biblioteca={biblioteca} value={substitutos} onChange={setSubstitutos} />
      <Button type="submit" className="w-full" disabled={submitting || !nome}>
        {submitting ? 'Salvando…' : submitLabel}
      </Button>
    </form>
  )
}

function ExLibRow({ ex, grupos, biblioteca }: { ex: ExLib; grupos: string[]; biblioteca: ExLib[] }) {
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

  const gruposEx = gruposDoExercicio(ex)
  const rotuloGrupos = gruposEx[0] === SEM_GRUPO ? null : gruposEx.join(' · ')

  return (
    <Card variant="elevated" className="flex items-start justify-between">
      <div className="min-w-0">
        <ExpandableText as="p" className="font-medium" text={rotuloGrupos ? `${ex.nome} · ${rotuloGrupos}` : ex.nome}>{ex.nome} {rotuloGrupos && <span className="text-xs text-text-muted">· {rotuloGrupos}</span>}</ExpandableText>
        <a href={videoUrlComFallback(ex.nome, ex.video_url)} target="_blank" rel="noreferrer" className="text-xs text-accent-hover inline-flex items-center gap-1 hover:underline">
          <Video size={12} /> vídeo
        </a>
        {ex.recomendacoes && <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap">{ex.recomendacoes}</p>}
      </div>
      <span className="flex gap-2 shrink-0">
        <Button variant="ghost" size="sm" iconOnly aria-label="Editar" onClick={() => setEdit(true)}><Pencil size={15} /></Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Remover" onClick={remove} className="hover:text-danger"><Trash2 size={15} /></Button>
      </span>

      <Modal open={edit} onClose={() => setEdit(false)} title="Editar exercício" size="lg">
        <ExLibForm initial={ex} grupos={grupos} biblioteca={biblioteca} submitLabel="Salvar" submitting={upd.isPending} onSubmit={save} />
      </Modal>
    </Card>
  )
}
