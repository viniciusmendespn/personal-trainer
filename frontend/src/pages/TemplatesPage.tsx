import { useState, useMemo, useId } from 'react'
import { Trash2, Users, LayoutTemplate, Dumbbell, Pencil, Plus, X, Search } from 'lucide-react'
import { useAlunos } from '../hooks/useAlunos'
import { useTemplates, useCreateTemplate, useDeleteTemplate, useUpdateTemplate, useAplicarTemplate } from '../hooks/useTemplates'
import { useBiblioteca } from '../hooks/useDominio'
import { Button, Card, Input, Textarea, Spinner, Modal, EmptyState, Badge, useToast, useConfirm } from '../components/ui'
import { SeriesPrescritasEditor, initSeriesPrescritas } from '../components/exercicios/SeriesPrescritasEditor'
import { SubstitutosTreinoEditor } from '../components/exercicios/SubstitutosTreinoEditor'
import type { ExercicioTemplate, TreinoTemplate, SeriePrescrita, TipoExercicio } from '../types'


export function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates()
  const [applyTarget, setApplyTarget] = useState<TreinoTemplate | null>(null)
  const [editTarget, setEditTarget] = useState<TreinoTemplate | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-xl font-semibold">Templates de treino</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <span className="flex items-center gap-1"><Plus size={14} /> Novo template</span>
        </Button>
      </div>
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo template" size="xl">
        <EditForm onDone={() => setCreateOpen(false)} />
      </Modal>
    </div>
  )
}

function TemplateCard({ template, onApply, onEdit }: { template: TreinoTemplate; onApply: () => void; onEdit: () => void }) {
  const del = useDeleteTemplate()
  const confirm = useConfirm()

  async function remove() {
    const ok = await confirm({
      title: 'Excluir template',
      message: `Excluir o template "${template.nome}"? Alunos que já o receberam não são afetados.`,
      confirmLabel: 'Excluir', tone: 'danger',
    })
    if (ok) del.mutate(template.template_id)
  }

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
          <Button variant="ghost" size="sm" iconOnly aria-label="Excluir template" onClick={remove} className="hover:text-danger">
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
  const [query, setQuery] = useState('')

  const alunosFiltrados = useMemo(
    () => (alunos ?? []).filter((a) => a.nome.toLowerCase().includes(query.toLowerCase())),
    [alunos, query]
  )

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
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <Input
          placeholder="Buscar aluno…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
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

const TIPO_OPTIONS: { value: TipoExercicio; label: string }[] = [
  { value: 'FORCA', label: 'Força' },
  { value: 'CARDIO', label: 'Cardio' },
  { value: 'PESO_CORPORAL', label: 'Peso Corporal' },
]

function EditForm({ template, onDone }: { template?: TreinoTemplate; onDone: () => void }) {
  const create = useCreateTemplate()
  const upd = useUpdateTemplate()
  const { show } = useToast()
  const { data: biblioteca } = useBiblioteca()
  const baseId = useId()
  const [nome, setNome] = useState(template?.nome ?? '')
  const [foco, setFoco] = useState(template?.foco ?? '')
  const [exercicios, setExercicios] = useState<ExercicioTemplate[]>(() =>
    (template?.exercicios ?? []).map((ex) => ({
      ...ex,
      series_prescritas: initSeriesPrescritas(ex.series_prescritas, ex.series, ex.reps_prescritas, ex.carga_prescrita),
    }))
  )
  const saving = create.isPending || upd.isPending

  const gruposUnicos = useMemo(
    () => Array.from(new Set((biblioteca ?? []).map((b) => b.grupo).filter(Boolean))) as string[],
    [biblioteca]
  )

  function updateEx(i: number, fields: Partial<ExercicioTemplate>) {
    setExercicios((exs) => exs.map((e, j) => (j === i ? { ...e, ...fields } : e)))
  }
  function removeEx(i: number) {
    setExercicios((exs) => exs.filter((_, j) => j !== i))
  }
  function addEx() {
    setExercicios((exs) => [
      ...exs,
      { nome: '', ordem: exs.length, tipo_exercicio: 'FORCA', series_prescritas: [{ series: 1, reps: '' }] },
    ])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    const body = { nome, foco: foco || undefined, exercicios: exercicios.filter((ex) => ex.nome.trim()) }
    if (template) {
      await upd.mutateAsync({ id: template.template_id, body })
      show('Template atualizado.', 'success')
    } else {
      await create.mutateAsync(body)
      show('Template criado.', 'success')
    }
    onDone()
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Nome" placeholder="ex: Treino A" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
        <Input label="Foco" placeholder="ex: Inferiores" value={foco} onChange={(e) => setFoco(e.target.value)} />
      </div>

      <div className="space-y-3">
        {exercicios.map((ex, i) => {
          const tipo = ex.tipo_exercicio ?? 'FORCA'
          const nomeListId = `${baseId}-ex-${i}-nome`
          const grupoListId = `${baseId}-ex-${i}-grupo`
          return (
            <Card key={i} variant="flat" className="relative">
              <Button
                type="button" variant="ghost" size="sm" iconOnly aria-label="Remover exercício"
                onClick={() => removeEx(i)} className="absolute top-3 right-3 hover:text-danger"
              >
                <X size={15} />
              </Button>
              <div className="space-y-3 pr-8">

                {/* Identificação */}
                <div>
                  <p className="text-xs font-medium text-text-secondary mb-2">Identificação</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Exercício"
                      className="col-span-2"
                      list={nomeListId}
                      value={ex.nome}
                      onChange={(e) => {
                        const v = e.target.value
                        const lib = biblioteca?.find((b) => b.nome.toLowerCase() === v.toLowerCase())
                        updateEx(i, {
                          nome: v,
                          ...(lib?.grupo && !ex.grupo ? { grupo: lib.grupo } : {}),
                        })
                      }}
                    />
                    <Input
                      label="Grupo muscular"
                      list={grupoListId}
                      value={ex.grupo ?? ''}
                      onChange={(e) => updateEx(i, { grupo: e.target.value || undefined })}
                    />
                  </div>
                  <datalist id={nomeListId}>
                    {biblioteca?.map((b) => <option key={b.exlib_id} value={b.nome} />)}
                  </datalist>
                  <datalist id={grupoListId}>
                    {gruposUnicos.map((g) => <option key={g} value={g} />)}
                  </datalist>
                </div>

                {/* Tipo de exercício */}
                <div>
                  <p className="text-xs font-medium text-text-secondary mb-2">Tipo de exercício</p>
                  <div className="flex gap-2">
                    {TIPO_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateEx(i, { tipo_exercicio: opt.value })}
                        className={`flex-1 text-xs py-1.5 px-2 rounded-lg border transition-colors ${
                          tipo === opt.value
                            ? 'border-accent bg-accent/10 text-accent-hover font-medium'
                            : 'border-border text-text-muted hover:border-border-strong'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prescrição */}
                <div>
                  <p className="text-xs font-medium text-text-secondary mb-2">
                    {tipo === 'CARDIO'
                      ? 'Prescrição — blocos × dur./dist. · RPE (1-10)'
                      : 'Prescrição — séries × reps · carga'}
                  </p>
                  <SeriesPrescritasEditor
                    value={ex.series_prescritas ?? []}
                    onChange={(v: SeriePrescrita[]) => updateEx(i, { series_prescritas: v })}
                    tipoExercicio={tipo}
                    rm_kg={ex.rm_kg}
                  />
                </div>

                {/* Vídeo, observações e 1RM */}
                <div>
                  <p className="text-xs font-medium text-text-secondary mb-2">Vídeo e observações</p>
                  <div className="space-y-3">
                    <Input label="Vídeo (URL)" value={ex.video_url ?? ''} onChange={(e) => updateEx(i, { video_url: e.target.value || undefined })} />
                    <Textarea label="Recomendações (visíveis ao aluno na sessão)" rows={2} value={ex.observacoes ?? ''} onChange={(e) => updateEx(i, { observacoes: e.target.value || undefined })} />
                    {tipo === 'FORCA' && (
                      <div>
                        <Input
                          label="1RM (kg)"
                          type="number"
                          min={1}
                          step={0.5}
                          placeholder="ex.: 100"
                          value={ex.rm_kg != null ? String(ex.rm_kg) : ''}
                          onChange={(e) => updateEx(i, { rm_kg: e.target.value ? parseFloat(e.target.value) : undefined })}
                        />
                        <p className="text-xs text-text-muted mt-1">
                          Carga máxima estimada para 1 repetição. Usada para calcular a Intensidade Relativa Média (IRM) na evolução.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Substitutos */}
                <SubstitutosTreinoEditor
                  exercicioNome={ex.nome}
                  biblioteca={biblioteca ?? []}
                  seriesPrescritasOriginal={ex.series_prescritas ?? []}
                  substitutos={ex.substitutos ?? []}
                  onChangeSubstitutos={(v) => updateEx(i, { substitutos: v })}
                  excluidos={ex.substitutos_excluidos ?? []}
                  onChangeExcluidos={(v) => updateEx(i, { substitutos_excluidos: v })}
                  tipoExercicio={tipo}
                />

              </div>
            </Card>
          )
        })}
      </div>

      <Button type="button" variant="ghost" size="sm" onClick={addEx}>
        <span className="flex items-center gap-1"><Plus size={14} /> Adicionar exercício</span>
      </Button>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? 'Salvando…' : template ? 'Salvar' : 'Criar template'}
      </Button>
    </form>
  )
}
