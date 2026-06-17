import { useState } from 'react'
import { Trash2, Users, LayoutTemplate, Dumbbell, Pencil, Plus, X } from 'lucide-react'
import { useAlunos } from '../hooks/useAlunos'
import { useTemplates, useDeleteTemplate, useUpdateTemplate, useAplicarTemplate } from '../hooks/useTemplates'
import { Button, Card, Input, Select, Textarea, Spinner, Modal, EmptyState, Badge, useToast } from '../components/ui'
import type { ExercicioTemplate, TreinoTemplate } from '../types'

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates()
  const [applyTarget, setApplyTarget] = useState<TreinoTemplate | null>(null)
  const [editTarget, setEditTarget] = useState<TreinoTemplate | null>(null)

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="font-display text-xl font-semibold mb-1">Templates de treino</h2>
      <p className="text-sm text-text-secondary mb-4">
        Salve um treino como modelo (no detalhe do aluno) e aplique-o a outros alunos rapidamente.
      </p>

      {isLoading ? (
        <Spinner />
      ) : !templates?.length ? (
        <EmptyState
          icon={<LayoutTemplate />}
          title="Nenhum template ainda"
          description='Abra um aluno, expanda um treino e use "Salvar como template" para criar o primeiro.'
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((t) => (
            <TemplateCard key={t.template_id} template={t} onApply={() => setApplyTarget(t)} onEdit={() => setEditTarget(t)} />
          ))}
        </div>
      )}

      <Modal open={!!applyTarget} onClose={() => setApplyTarget(null)} title={`Aplicar "${applyTarget?.nome}"`}>
        {applyTarget && <AplicarForm template={applyTarget} onDone={() => setApplyTarget(null)} />}
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar template" size="xl">
        {editTarget && <EditForm template={editTarget} onDone={() => setEditTarget(null)} />}
      </Modal>
    </div>
  )
}

function TemplateCard({ template, onApply, onEdit }: { template: TreinoTemplate; onApply: () => void; onEdit: () => void }) {
  const del = useDeleteTemplate()
  return (
    <Card variant="elevated">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{template.nome}</p>
          {template.foco && <p className="text-xs text-text-muted">{template.foco}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" iconOnly aria-label="Editar template" onClick={onEdit}>
            <Pencil size={15} />
          </Button>
          <Button variant="ghost" size="sm" iconOnly aria-label="Excluir template" onClick={() => del.mutate(template.template_id)} className="hover:text-danger">
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
      <Badge tone="neutral" className="mt-2">
        <Dumbbell size={11} /> {template.exercicios.length} exercício{template.exercicios.length === 1 ? '' : 's'}
      </Badge>
      <Button size="sm" variant="outline" className="w-full mt-3" onClick={onApply}>
        <span className="flex items-center gap-1"><Users size={14} /> Aplicar a alunos</span>
      </Button>
    </Card>
  )
}

function AplicarForm({ template, onDone }: { template: TreinoTemplate; onDone: () => void }) {
  const { data: alunos } = useAlunos()
  const aplicar = useAplicarTemplate()
  const { show } = useToast()
  const [selected, setSelected] = useState<string[]>([])

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function submit() {
    if (!selected.length) return
    const r = await aplicar.mutateAsync({ id: template.template_id, alunoIds: selected })
    show(`Template aplicado a ${r.aplicados.length} aluno(s).`, 'success')
    onDone()
  }

  return (
    <div className="space-y-3">
      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {alunos?.map((a) => (
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

function EditForm({ template, onDone }: { template: TreinoTemplate; onDone: () => void }) {
  const upd = useUpdateTemplate()
  const { show } = useToast()
  const [nome, setNome] = useState(template.nome)
  const [foco, setFoco] = useState(template.foco ?? '')
  const [exercicios, setExercicios] = useState<ExercicioTemplate[]>(template.exercicios)

  function updateEx(i: number, fields: Partial<ExercicioTemplate>) {
    setExercicios((exs) => exs.map((e, j) => (j === i ? { ...e, ...fields } : e)))
  }
  function removeEx(i: number) {
    setExercicios((exs) => exs.filter((_, j) => j !== i))
  }
  function addEx() {
    setExercicios((exs) => [...exs, { nome: '', ordem: exs.length }])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    await upd.mutateAsync({
      id: template.template_id,
      body: { nome, foco: foco || undefined, exercicios: exercicios.filter((ex) => ex.nome.trim()) },
    })
    show('Template atualizado.', 'success')
    onDone()
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <Input label="Foco" value={foco} onChange={(e) => setFoco(e.target.value)} />
      </div>

      <div className="space-y-3">
        {exercicios.map((ex, i) => (
          <Card key={i} variant="flat" className="relative">
            <Button
              type="button" variant="ghost" size="sm" iconOnly aria-label="Remover exercício"
              onClick={() => removeEx(i)} className="absolute top-3 right-3 hover:text-danger"
            >
              <X size={15} />
            </Button>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-8">
              <Input label="Exercício" className="col-span-2 sm:col-span-3" value={ex.nome} onChange={(e) => updateEx(i, { nome: e.target.value })} />
              <Input label="Séries" value={ex.series ?? ''} onChange={(e) => updateEx(i, { series: e.target.value ? Number(e.target.value) : undefined })} />
              <Input label="Reps" value={ex.reps_prescritas ?? ''} onChange={(e) => updateEx(i, { reps_prescritas: e.target.value || undefined })} />
              <Input label="Carga" value={ex.carga_prescrita ?? ''} onChange={(e) => updateEx(i, { carga_prescrita: e.target.value || undefined })} />
              <Select label="Dia" value={ex.dia_semana ?? ''} onChange={(e) => updateEx(i, { dia_semana: e.target.value === '' ? null : Number(e.target.value) })}>
                <option value="">Todo dia</option>
                {DIAS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
              </Select>
              <Input label="Vídeo" className="col-span-2" value={ex.video_url ?? ''} onChange={(e) => updateEx(i, { video_url: e.target.value || undefined })} />
              <Textarea label="Observações" className="col-span-2 sm:col-span-3" rows={2} value={ex.observacoes ?? ''} onChange={(e) => updateEx(i, { observacoes: e.target.value || undefined })} />
            </div>
          </Card>
        ))}
      </div>

      <Button type="button" variant="ghost" size="sm" onClick={addEx}>
        <span className="flex items-center gap-1"><Plus size={14} /> Adicionar exercício</span>
      </Button>

      <Button type="submit" className="w-full" disabled={upd.isPending}>
        {upd.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}
