import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Trophy, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { useAluno } from '../hooks/useAlunos'
import { useExerciciosAluno, useEvolucao, useResumo } from '../hooks/useEvolucao'
import { Card, Spinner } from '../components/ui'

const chartTip = { background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }

export function AlunoEvolucaoPage() {
  const { alunoId = '' } = useParams()
  const { data: aluno } = useAluno(alunoId)
  const { data: exercicios } = useExerciciosAluno(alunoId)
  const { data: resumo } = useResumo(alunoId)
  const [exId, setExId] = useState('')

  useEffect(() => {
    if (!exId && exercicios?.length) setExId(exercicios[0].exercicio_id)
  }, [exercicios, exId])

  const { data: evo, isLoading } = useEvolucao(alunoId, exId)
  const exSel = exercicios?.find((e) => e.exercicio_id === exId)
  const prescrita = exSel?.carga_prescrita ? Number(String(exSel.carga_prescrita).replace(',', '.')) : NaN

  const chartData = (evo?.serie ?? [])
    .filter((p) => p.carga_max != null)
    .map((p) => ({
      data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      carga: p.carga_max,
    }))

  const semanas = (resumo?.semanas ?? []).map((w) => ({
    semana: w.semana.replace(/^\d+-/, ''),
    volume: w.volume,
  }))

  return (
    <div className="max-w-3xl mx-auto">
      <Link to={`/alunos/${alunoId}`} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> {aluno?.nome ?? 'Aluno'}
      </Link>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <TrendingUp size={20} className="text-emerald-400" /> Evolução
      </h2>

      {/* Resumo do aluno (agregados) */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card><p className="text-2xl font-bold">{resumo?.total_sessoes ?? 0}</p><p className="text-xs text-slate-500">Sessões totais</p></Card>
        <Card><p className="text-2xl font-bold">{Math.round(resumo?.total_volume ?? 0).toLocaleString('pt-BR')}</p><p className="text-xs text-slate-500">Volume total (kg)</p></Card>
        <Card><p className="text-2xl font-bold">{resumo?.sessoes_semana ?? 0}</p><p className="text-xs text-slate-500">Sessões esta semana</p></Card>
      </div>

      {semanas.length > 0 && (
        <Card className="mb-4">
          <p className="text-sm text-slate-400 mb-3">Volume por semana</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={semanas} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="semana" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={chartTip} />
              <Bar dataKey="volume" fill="#10b981" radius={[4, 4, 0, 0]} name="Volume (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {resumo?.prs?.length ? (
        <Card className="mb-6">
          <p className="text-sm text-slate-400 mb-2 flex items-center gap-1"><Trophy size={14} className="text-amber-400" /> Recordes</p>
          <div className="flex flex-wrap gap-2">
            {resumo.prs.map((p) => (
              <span key={p.exercicio} className="text-xs bg-slate-800 rounded-full px-3 py-1">
                {p.exercicio}: <b className="text-amber-300">{p.carga} kg</b>
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Evolução por exercício */}
      <h3 className="text-sm font-medium text-slate-300 mb-2">Carga por exercício</h3>
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
            <p className="text-slate-500 text-sm">Sem registros com carga numérica ainda.</p>
          ) : (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-400">Carga máxima por sessão</p>
                <span className="text-xs text-amber-300 flex items-center gap-1"><Trophy size={12} /> PR {evo?.pr?.carga ?? '—'} kg</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="data" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={chartTip} />
                  {!isNaN(prescrita) && (
                    <ReferenceLine y={prescrita} stroke="#64748b" strokeDasharray="4 4"
                      label={{ value: `prescrita ${prescrita}`, fill: '#64748b', fontSize: 11, position: 'insideTopRight' }} />
                  )}
                  <Line type="monotone" dataKey="carga" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Carga (kg)" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
