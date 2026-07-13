import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plane, Plus, Trash2 } from 'lucide-react'
import type { Ferias, FeriasCreate } from '../../api/ferias'
import { feriasTsId } from '../../api/ferias'
import { formatDiaMes } from '../../utils/ferias'
import { Button, Card, Input, Modal, Spinner, Textarea, useConfirm, useToast } from '../ui'

interface FeriasPanelProps {
  /** queryKey da lista de férias (diferencie por contexto/aluno). */
  queryKey: unknown[]
  list: () => Promise<Ferias[]>
  create: (body: FeriasCreate) => Promise<Ferias>
  remove: (tsId: string) => Promise<unknown>
  /** Chamado após criar/remover — use para invalidar o calendário do histórico. */
  onChanged?: () => void
}

function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function periodoLabel(f: Ferias): string {
  return `${formatDiaMes(f.data_inicio)} – ${formatDiaMes(f.data_fim)}`
}

export function FeriasPanel({ queryKey, list, create, remove, onChanged }: FeriasPanelProps) {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [ini, setIni] = useState('')
  const [fim, setFim] = useState('')
  const [obs, setObs] = useState('')

  const { data: ferias = [], isLoading } = useQuery({ queryKey, queryFn: list, staleTime: 60_000 })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey })
    onChanged?.()
  }

  const salvar = useMutation({
    mutationFn: () => create({ data_inicio: ini, data_fim: fim, observacao: obs.trim() || undefined }),
    onSuccess: () => {
      invalidar()
      setOpen(false)
      setIni(''); setFim(''); setObs('')
      toast.show('Período de férias registrado.', 'success')
    },
    onError: () => toast.show('Não consegui registrar. Tente de novo.', 'error'),
  })

  const cancelar = useMutation({
    mutationFn: (f: Ferias) => remove(feriasTsId(f)),
    onSuccess: () => { invalidar(); toast.show('Período removido.', 'success') },
    onError: () => toast.show('Não consegui remover. Tente de novo.', 'error'),
  })

  const hoje = hojeIso()
  const proximas = ferias.filter((f) => f.data_fim >= hoje)
  const passadas = ferias.filter((f) => f.data_fim < hoje)
  const datasInvalidas = !ini || !fim || fim < ini

  async function pedirCancelar(f: Ferias) {
    const ok = await confirm({
      title: 'Remover período de férias?',
      message: `${periodoLabel(f)}${f.observacao ? ` — ${f.observacao}` : ''}`,
      confirmLabel: 'Remover',
      tone: 'danger',
    })
    if (ok) cancelar.mutate(f)
  }

  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-display font-semibold">
          <Plane size={16} className="text-accent" /> Férias / ausências
        </p>
        <Button variant="outline" className="text-sm px-2.5 py-1.5" onClick={() => setOpen(true)}>
          <span className="flex items-center gap-1"><Plus size={14} /> Registrar</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-3"><Spinner /></div>
      ) : ferias.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhum período registrado. Avise com antecedência quando for ficar ausente.</p>
      ) : (
        <div className="space-y-1.5">
          {[...proximas, ...passadas].map((f) => {
            const passada = f.data_fim < hoje
            return (
              <div
                key={feriasTsId(f)}
                className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 ${passada ? 'opacity-60' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{periodoLabel(f)}</p>
                  {f.observacao && <p className="truncate text-xs text-text-muted">{f.observacao}</p>}
                </div>
                <button
                  onClick={() => pedirCancelar(f)}
                  disabled={cancelar.isPending}
                  className="p-1.5 text-text-muted hover:text-danger transition-colors disabled:opacity-40"
                  aria-label="Remover período"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Registrar férias / ausência" size="md">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input label="Início" type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="flex-1" />
            <Input label="Fim" type="date" value={fim} min={ini || undefined} onChange={(e) => setFim(e.target.value)} className="flex-1" />
          </div>
          {ini && fim && fim < ini && (
            <p className="text-xs text-danger">A data final não pode ser anterior à inicial.</p>
          )}
          <Textarea label="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: viagem em família" className="min-h-16" />
          <Button variant="energy" className="w-full" onClick={() => salvar.mutate()} disabled={datasInvalidas || salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Registrar'}
          </Button>
        </div>
      </Modal>
    </Card>
  )
}
