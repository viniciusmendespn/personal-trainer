import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Users, ListChecks, Dumbbell, Pencil, Plus, Search, ChevronUp, ChevronDown, X, Layers } from 'lucide-react'
import { useAlunos } from '../hooks/useAlunos'
import {
  useRotinas, useDeleteRotina, useAplicarRotina, useCreateRotinaFromTemplates, useUpdateRotina,
} from '../hooks/useRotinas'
import { useTemplates } from '../hooks/useTemplates'
import { Button, Card, Input, Textarea, Spinner, Modal, EmptyState, Badge, useToast, useConfirm } from '../components/ui'
import type { Rotina, TreinoRotina, AplicarRotinaModo, TreinoTemplate } from '../types'

function contaExercicios(r: Rotina): number {
  return r.treinos.reduce((sum, t) => sum + (t.exercicios?.length ?? 0), 0)
}

export function RotinasPage() {
  const { data: rotinas, isLoading } = useRotinas()
  const [applyTarget, setApplyTarget] = useState<Rotina | null>(null)
  const [editTarget, setEditTarget] = useState<Rotina | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-xl font-semibold">Rotinas de treino</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <span className="flex items-center gap-1"><Plus size={14} /> Nova rotina</span>
        </Button>
      </div>
      <p className="text-sm text-text-secondary mb-4">
        Uma rotina é um split completo (ABC, ABCDE…). Salve a rotina de um aluno pelo botão no
        detalhe dele, ou monte uma do zero juntando templates — e aplique tudo de uma vez.
      </p>

      {isLoading ? (
        <Spinner />
      ) : !rotinas?.length ? (
        <EmptyState
          icon={<ListChecks />}
          title="Nenhuma rotina ainda"
          description='Abra um aluno com treinos e use "Salvar rotina", ou clique em "Nova rotina" para juntar templates.'
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rotinas.map((r) => (
            <RotinaCard key={r.rotina_id} rotina={r} onApply={() => setApplyTarget(r)} onEdit={() => setEditTarget(r)} />
          ))}
        </div>
      )}

      <Modal open={!!applyTarget} onClose={() => setApplyTarget(null)} title={`Aplicar "${applyTarget?.nome}"`}>
        {applyTarget && <AplicarForm rotina={applyTarget} onDone={() => setApplyTarget(null)} />}
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar rotina" size="lg">
        {editTarget && <EditForm rotina={editTarget} onDone={() => setEditTarget(null)} />}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova rotina (juntar templates)" size="lg">
        <CreateForm onDone={() => setCreateOpen(false)} />
      </Modal>
    </div>
  )
}

function RotinaCard({ rotina, onApply, onEdit }: { rotina: Rotina; onApply: () => void; onEdit: () => void }) {
  const del = useDeleteRotina()
  const confirm = useConfirm()

  async function remove() {
    const ok = await confirm({
      title: 'Excluir rotina',
      message: `Excluir a rotina "${rotina.nome}"? Alunos que já a receberam não são afetados.`,
      confirmLabel: 'Excluir', tone: 'danger',
    })
    if (ok) del.mutate(rotina.rotina_id)
  }

  return (
    <Card variant="elevated">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{rotina.nome}</p>
          {rotina.descricao && <p className="text-xs text-text-muted">{rotina.descricao}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" iconOnly aria-label="Editar rotina" onClick={onEdit}>
            <Pencil size={15} />
          </Button>
          <Button variant="ghost" size="sm" iconOnly aria-label="Excluir rotina" onClick={remove} className="hover:text-danger">
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Badge tone="neutral"><Layers size={11} /> {rotina.treinos.length} treino{rotina.treinos.length === 1 ? '' : 's'}</Badge>
        <Badge tone="neutral"><Dumbbell size={11} /> {contaExercicios(rotina)} exercício{contaExercicios(rotina) === 1 ? '' : 's'}</Badge>
      </div>
      <Button size="sm" variant="outline" className="w-full mt-3" onClick={onApply}>
        <span className="flex items-center gap-1"><Users size={14} /> Aplicar a alunos</span>
      </Button>
    </Card>
  )
}

const MODO_OPTIONS: { value: AplicarRotinaModo; label: string; hint: string }[] = [
  { value: 'adicionar', label: 'Adicionar ao lado', hint: 'Mantém os treinos atuais do aluno' },
  { value: 'substituir', label: 'Substituir tudo', hint: 'Apaga os treinos atuais e cria os da rotina' },
]

function AplicarForm({ rotina, onDone }: { rotina: Rotina; onDone: () => void }) {
  const { data: alunos } = useAlunos()
  const aplicar = useAplicarRotina()
  const confirm = useConfirm()
  const { show } = useToast()
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [modo, setModo] = useState<AplicarRotinaModo>('adicionar')

  const alunosFiltrados = useMemo(
    () => (alunos ?? []).filter((a) => a.nome.toLowerCase().includes(query.toLowerCase())),
    [alunos, query]
  )

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function submit() {
    if (!selected.length) return
    if (modo === 'substituir') {
      const ok = await confirm({
        title: 'Substituir treinos',
        message: `Isso apaga TODOS os treinos atuais de ${selected.length} aluno(s) e cria os da rotina no lugar. Continuar?`,
        confirmLabel: 'Substituir', tone: 'danger',
      })
      if (!ok) return
    }
    const r = await aplicar.mutateAsync({ id: rotina.rotina_id, alunoIds: selected, modo })
    show(`Rotina aplicada a ${r.aplicados.length} aluno(s).`, 'success')
    onDone()
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Ao aplicar num aluno que já tem treinos</p>
        <div className="flex gap-2">
          {MODO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setModo(opt.value)}
              className={`flex-1 text-left text-xs py-2 px-2.5 rounded-lg border transition-colors ${
                modo === opt.value
                  ? 'border-accent bg-accent/10 text-accent-hover'
                  : 'border-border text-text-muted hover:border-border-strong'
              }`}
            >
              <span className="font-medium block">{opt.label}</span>
              <span className="text-[11px] opacity-80">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <Input placeholder="Buscar aluno…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {alunosFiltrados.map((a) => (
          <label key={a.aluno_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
            <input type="checkbox" checked={selected.includes(a.aluno_id)} onChange={() => toggle(a.aluno_id)} className="accent-accent" />
            <span className="text-sm">{a.nome}</span>
          </label>
        ))}
      </div>
      <Button className="w-full" onClick={submit} disabled={!selected.length || aplicar.isPending}>
        {aplicar.isPending ? 'Aplicando…' : `Aplicar a ${selected.length || ''} aluno(s)`}
      </Button>
    </div>
  )
}

/** Seletor de templates reutilizado por criação e edição (adicionar treinos à rotina). */
function TemplatePicker({ onAdd }: { onAdd: (tpl: TreinoTemplate) => void }) {
  const { data: templates } = useTemplates()
  const [query, setQuery] = useState('')
  const filtrados = useMemo(
    () => (templates ?? []).filter((t) => t.nome.toLowerCase().includes(query.toLowerCase())),
    [templates, query]
  )
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <Input placeholder="Buscar template…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
      </div>
      {!templates?.length ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs text-text-muted">Nenhum template criado ainda.</p>
          <Link to="/templates" className="text-xs font-medium text-accent hover:underline">
            Criar primeiro template →
          </Link>
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
          {filtrados.map((t) => (
            <button
              key={t.template_id}
              type="button"
              onClick={() => onAdd(t)}
              className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <span className="text-sm truncate">{t.nome}</span>
              <Badge tone="neutral"><Dumbbell size={10} /> {t.exercicios.length}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TreinoList({ treinos, onMove, onRemove }: {
  treinos: TreinoRotina[]
  onMove: (i: number, dir: -1 | 1) => void
  onRemove: (i: number) => void
}) {
  if (!treinos.length) return <p className="text-xs text-text-muted">Nenhum treino na rotina ainda.</p>
  return (
    <div className="space-y-1.5">
      {treinos.map((t, i) => (
        <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border">
          <span className="text-xs text-text-muted w-5 shrink-0">{String.fromCharCode(65 + i)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate">{t.nome}</p>
            {t.foco && <p className="text-[11px] text-text-muted truncate">{t.foco}</p>}
          </div>
          <Badge tone="neutral"><Dumbbell size={10} /> {t.exercicios.length}</Badge>
          <div className="flex items-center shrink-0">
            <Button type="button" variant="ghost" size="sm" iconOnly aria-label="Subir" onClick={() => onMove(i, -1)} disabled={i === 0}><ChevronUp size={14} /></Button>
            <Button type="button" variant="ghost" size="sm" iconOnly aria-label="Descer" onClick={() => onMove(i, 1)} disabled={i === treinos.length - 1}><ChevronDown size={14} /></Button>
            <Button type="button" variant="ghost" size="sm" iconOnly aria-label="Remover" onClick={() => onRemove(i)} className="hover:text-danger"><X size={14} /></Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function tplToTreino(tpl: TreinoTemplate, ordem: number): TreinoRotina {
  return { nome: tpl.nome, foco: tpl.foco, ordem, exercicios: tpl.exercicios }
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const create = useCreateRotinaFromTemplates()
  const { show } = useToast()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [selected, setSelected] = useState<TreinoTemplate[]>([])

  function addTemplate(tpl: TreinoTemplate) {
    setSelected((ts) => [...ts, tpl])
  }
  function move(i: number, dir: -1 | 1) {
    setSelected((ts) => {
      const j = i + dir
      if (j < 0 || j >= ts.length) return ts
      const copy = [...ts]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }
  function remove(i: number) {
    setSelected((ts) => ts.filter((_, j) => j !== i))
  }

  const treinos = useMemo(() => selected.map((t, i) => tplToTreino(t, i)), [selected])

  async function save() {
    if (!nome.trim() || !selected.length) return
    await create.mutateAsync({ nome, templateIds: selected.map((t) => t.template_id), descricao: descricao || undefined })
    show('Rotina criada.', 'success')
    onDone()
  }

  return (
    <div className="space-y-3">
      <Input label="Nome da rotina" placeholder="ex.: Rotina ABC — Hipertrofia" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      <Textarea label="Descrição (opcional)" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Treinos da rotina</p>
        <TreinoList treinos={treinos} onMove={move} onRemove={remove} />
      </div>
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Adicionar treino a partir de template</p>
        <TemplatePicker onAdd={addTemplate} />
      </div>
      <Button className="w-full" onClick={save} disabled={!nome.trim() || !selected.length || create.isPending}>
        {create.isPending ? 'Criando…' : 'Criar rotina'}
      </Button>
    </div>
  )
}

function EditForm({ rotina, onDone }: { rotina: Rotina; onDone: () => void }) {
  const upd = useUpdateRotina()
  const { show } = useToast()
  const [nome, setNome] = useState(rotina.nome)
  const [descricao, setDescricao] = useState(rotina.descricao ?? '')
  const [treinos, setTreinos] = useState<TreinoRotina[]>(rotina.treinos)

  function addTemplate(tpl: TreinoTemplate) {
    setTreinos((ts) => [...ts, tplToTreino(tpl, ts.length)])
  }
  function move(i: number, dir: -1 | 1) {
    setTreinos((ts) => {
      const j = i + dir
      if (j < 0 || j >= ts.length) return ts
      const copy = [...ts]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy.map((t, k) => ({ ...t, ordem: k }))
    })
  }
  function remove(i: number) {
    setTreinos((ts) => ts.filter((_, j) => j !== i).map((t, k) => ({ ...t, ordem: k })))
  }

  async function save() {
    if (!nome.trim()) return
    await upd.mutateAsync({ id: rotina.rotina_id, body: { nome, descricao: descricao || undefined, treinos } })
    show('Rotina atualizada.', 'success')
    onDone()
  }

  return (
    <div className="space-y-3">
      <Input label="Nome da rotina" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      <Textarea label="Descrição (opcional)" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Treinos da rotina</p>
        <TreinoList treinos={treinos} onMove={move} onRemove={remove} />
      </div>
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Adicionar treino a partir de template</p>
        <TemplatePicker onAdd={addTemplate} />
      </div>
      <Button className="w-full" onClick={save} disabled={!nome.trim() || upd.isPending}>
        {upd.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </div>
  )
}
