import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAluno } from '../hooks/useAlunos'
import { useAvaliacoes, useCreateAvaliacao } from '../hooks/useDominio'
import { Button, Card, Input, Spinner } from '../components/ui'

export function AvaliacoesPage() {
  const { alunoId = '' } = useParams()
  const { data: aluno } = useAluno(alunoId)
  const { data: avs, isLoading } = useAvaliacoes(alunoId)
  const create = useCreateAvaliacao(alunoId)
  const [peso, setPeso] = useState('')
  const [gordura, setGordura] = useState('')
  const [open, setOpen] = useState(false)

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
      <Link to={`/alunos/${alunoId}`} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> {aluno?.nome ?? 'Aluno'}
      </Link>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Avaliação física</h2>
        <Button onClick={() => setOpen((v) => !v)}><span className="flex items-center gap-1"><Plus size={16} /> Nova</span></Button>
      </div>

      {open && (
        <Card className="mb-4">
          <form onSubmit={submit} className="flex gap-2 items-end">
            <Input label="Peso (kg)" value={peso} onChange={(e) => setPeso(e.target.value)} className="w-28" />
            <Input label="% Gordura" value={gordura} onChange={(e) => setGordura(e.target.value)} className="w-28" />
            <Button type="submit" disabled={create.isPending}>Salvar</Button>
          </form>
        </Card>
      )}

      {chart.length > 1 && (
        <Card className="mb-4">
          <p className="text-sm text-slate-400 mb-3">Peso ao longo do tempo</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chart} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="data" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              <Line type="monotone" dataKey="peso" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Peso (kg)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : !avs?.length ? (
        <p className="text-slate-500 text-sm">Nenhuma avaliação ainda.</p>
      ) : (
        <div className="space-y-2">
          {[...avs].sort((a, b) => (b.data ?? b.created_at).localeCompare(a.data ?? a.created_at)).map((a) => (
            <Card key={a.avaliacao_id} className="flex items-center justify-between text-sm">
              <span>{new Date(a.data ?? a.created_at).toLocaleDateString('pt-BR')}</span>
              <span className="text-slate-300">
                {a.peso != null ? `${a.peso} kg` : ''} {a.percentual_gordura != null ? `· ${a.percentual_gordura}%` : ''}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
