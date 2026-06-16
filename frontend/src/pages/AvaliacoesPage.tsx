import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Scale, FileDown } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAluno } from '../hooks/useAlunos'
import { useAvaliacoes, useCreateAvaliacao } from '../hooks/useDominio'
import { Button, Card, Input, Spinner, Modal, EmptyState, useToast } from '../components/ui'
import { RelatorioPrintLayout } from '../components/pdf/RelatorioPrintLayout'
import { renderNodeToPdf } from '../utils/exportPdf'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: 'var(--color-text)',
  fontSize: 12,
}
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 12 }

export function AvaliacoesPage() {
  const { alunoId = '' } = useParams()
  const { data: aluno } = useAluno(alunoId)
  const { data: avs, isLoading } = useAvaliacoes(alunoId)
  const create = useCreateAvaliacao(alunoId)
  const [peso, setPeso] = useState('')
  const [gordura, setGordura] = useState('')
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { show } = useToast()

  async function exportarPdf() {
    if (!avs?.length) return
    setExporting(true)
    try {
      await renderNodeToPdf(
        <RelatorioPrintLayout
          alunoNome={aluno?.nome ?? 'Aluno'}
          avaliacoes={[...avs]
            .sort((a, b) => (b.data ?? b.created_at).localeCompare(a.data ?? a.created_at))
            .map((a) => ({ data: a.data ?? a.created_at, peso: a.peso, percentual_gordura: a.percentual_gordura }))}
        />,
        `avaliacoes-${aluno?.nome ?? 'aluno'}.pdf`
      )
    } catch {
      show('Não foi possível gerar o PDF.', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync({
      peso: peso ? Number(peso) : undefined,
      percentual_gordura: gordura ? Number(gordura) : undefined,
    })
    setPeso(''); setGordura(''); setOpen(false)
  }

  const chart = [...(avs ?? [])]
    .filter((a) => a.peso != null)
    .sort((a, b) => (a.data ?? a.created_at).localeCompare(b.data ?? b.created_at))
    .map((a) => ({
      data: new Date(a.data ?? a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      peso: a.peso,
    }))

  return (
    <div className="max-w-3xl mx-auto">
      <Link to={`/alunos/${alunoId}`} className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text mb-4">
        <ArrowLeft size={16} /> {aluno?.nome ?? 'Aluno'}
      </Link>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="font-display text-xl font-semibold">Avaliação física</h2>
        <div className="flex items-center gap-2">
          {!!avs?.length && (
            <Button variant="outline" size="sm" onClick={exportarPdf} disabled={exporting}>
              <span className="flex items-center gap-1"><FileDown size={14} /> {exporting ? 'Gerando…' : 'PDF'}</span>
            </Button>
          )}
          <Button onClick={() => setOpen(true)}><span className="flex items-center gap-1"><Plus size={16} /> Nova</span></Button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova avaliação">
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <Input label="Peso (kg)" value={peso} onChange={(e) => setPeso(e.target.value)} />
          <Input label="% Gordura" value={gordura} onChange={(e) => setGordura(e.target.value)} />
          <Button type="submit" disabled={create.isPending} className="col-span-2">Salvar</Button>
        </form>
      </Modal>

      {chart.length > 1 && (
        <Card variant="elevated" className="mb-4">
          <p className="text-sm text-text-secondary mb-3">Peso ao longo do tempo</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chart} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="pesoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-energy)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-energy)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="data" tick={axisTick} stroke="var(--color-border-strong)" />
              <YAxis tick={axisTick} stroke="var(--color-border-strong)" domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip contentStyle={chartTip} />
              <Area type="monotone" dataKey="peso" stroke="var(--color-energy)" strokeWidth={2.5}
                fill="url(#pesoGradient)" dot={{ r: 3, fill: 'var(--color-energy)' }} name="Peso (kg)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : !avs?.length ? (
        <EmptyState icon={<Scale />} title="Nenhuma avaliação ainda" description="Registre a primeira avaliação física do aluno." action={<Button onClick={() => setOpen(true)}>Nova avaliação</Button>} />
      ) : (
        <div className="space-y-2">
          {[...avs].sort((a, b) => (b.data ?? b.created_at).localeCompare(a.data ?? a.created_at)).map((a) => (
            <Card key={a.avaliacao_id} variant="elevated" className="flex items-center justify-between text-sm">
              <span>{new Date(a.data ?? a.created_at).toLocaleDateString('pt-BR')}</span>
              <span className="text-text-secondary">
                {a.peso != null ? `${a.peso} kg` : ''} {a.percentual_gordura != null ? `· ${a.percentual_gordura}%` : ''}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
