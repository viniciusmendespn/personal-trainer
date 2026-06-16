import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Trophy, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAluno } from '../hooks/useAlunos'
import { useExerciciosAluno, useEvolucao } from '../hooks/useEvolucao'
import { Card, Spinner } from '../components/ui'

export function AlunoEvolucaoPage() {
  const { alunoId = '' } = useParams()
  const { data: aluno } = useAluno(alunoId)
  const { data: exercicios } = useExerciciosAluno(alunoId)
  const [exId, setExId] = useState('')

  useEffect(() => {
    if (!exId && exercicios?.length) setExId(exercicios[0].exercicio_id)
  }, [exercicios, exId])

  const { data: evo, isLoading } = useEvolucao(alunoId, exId)

  const chartData = (evo?.serie ?? [])
    .filter((p) => p.carga_max != null)
    .map((p) => ({
      data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      carga: p.carga_max,
      volume: p.volume,
    }))

  return (
    <div className="max-w-3xl mx-auto">
      <Link to={`/alunos/${alunoId}`} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> {aluno?.nome ?? 'Aluno'}
      </Link>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <TrendingUp size={20} className="text-emerald-400" /> Evolução
      </h2>

      {!exercicios?.length ? (
        <p className="text-slate-500 text-sm">Cadastre exercícios para acompanhar a evolução.</p>
      ) : (
        <>
          <select
            value={exId}
            onChange={(e) => setExId(e.target.value)}
            className="mb-4 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
          >
            {exercicios.map((ex) => (
              <option key={ex.exercicio_id} value={ex.exercicio_id}>{ex.nome}</option>
            ))}
          </select>

          {isLoading ? (
            <Spinner />
          ) : !chartData.length ? (
            <p className="text-slate-500 text-sm">Sem registros com carga numérica para este exercício ainda.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Card className="flex items-center gap-3">
                  <Trophy size={22} className="text-amber-400" />
                  <div>
                    <p className="text-2xl font-bold">{evo?.pr?.carga ?? '—'} kg</p>
                    <p className="text-xs text-slate-500">Recorde (PR)</p>
                  </div>
                </Card>
                <Card>
                  <p className="text-2xl font-bold">{evo?.total_sessoes ?? 0}</p>
                  <p className="text-xs text-slate-500">Sessões registradas</p>
                </Card>
              </div>

              <Card>
                <p className="text-sm text-slate-400 mb-3">Carga máxima por sessão</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="data" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="carga" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Carga (kg)" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
