import { useState } from 'react'
import { Trash2, Users, LayoutTemplate, Dumbbell } from 'lucide-react'
import { useAlunos } from '../hooks/useAlunos'
import { useTemplates, useDeleteTemplate, useAplicarTemplate } from '../hooks/useTemplates'
import { Button, Card, Spinner, Modal, EmptyState, Badge, useToast } from '../components/ui'
import type { TreinoTemplate } from '../types'

export function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates()
  const [applyTarget, setApplyTarget] = useState<TreinoTemplate | null>(null)

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
            <TemplateCard key={t.template_id} template={t} onApply={() => setApplyTarget(t)} />
          ))}
        </div>
      )}

      <Modal open={!!applyTarget} onClose={() => setApplyTarget(null)} title={`Aplicar "${applyTarget?.nome}"`}>
        {applyTarget && <AplicarForm template={applyTarget} onDone={() => setApplyTarget(null)} />}
      </Modal>
    </div>
  )
}

function TemplateCard({ template, onApply }: { template: TreinoTemplate; onApply: () => void }) {
  const del = useDeleteTemplate()
  return (
    <Card variant="elevated">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{template.nome}</p>
          {template.foco && <p className="text-xs text-text-muted">{template.foco}</p>}
        </div>
        <Button variant="ghost" size="sm" iconOnly aria-label="Excluir template" onClick={() => del.mutate(template.template_id)} className="hover:text-danger shrink-0">
          <Trash2 size={15} />
        </Button>
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
