import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Trophy, TrendingUp, Activity, BarChart3, CalendarCheck, FileDown } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { useAluno } from '../hooks/useAlunos'
import { useExerciciosAluno, useEvolucao, useResumo } from '../hooks/useEvolucao'
import { useMidiaExercicio } from '../hooks/useTreinos'
import { Card, Spinner, Select, StatCard, Badge, EmptyState, Button, useToast } from '../components/ui'
import { MediaTimeline } from '../components/media/MediaTimeline'
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

export function AlunoEvolucaoPage() {
  const { alunoId = '' } = useParams()
  const { data: aluno } = useAluno(alunoId)
  const { data: exercicios } = useExerciciosAluno(alunoId)
  const { data: resumo } = useResumo(alunoId)
  const [exId, setExId] = useState('')
  const [exporting, setExporting] = useState(false)
  const { show } = useToast()

  async function exportarPdf() {
    if (!resumo) return
    setExporting(true)
    try {
      await renderNodeToPdf(
        <RelatorioPrintLayout alunoNome={aluno?.nome ?? 'Aluno'} resumo={resumo} />,
        `evolucao-${aluno?.nome ?? 'aluno'}.pdf`
      )
    } catch {
      show('Não foi possível gerar o PDF.', 'error')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    if (!exId && exercicios?.length) setExId(exercicios[0].exercicio_id)
  }, [exercicios, exId])

  const { data: evo, isLoading } = useEvolucao(alunoId, exId)
  const { data: midias, isLoading: midiasLoading } = useMidiaExercicio(alunoId, exId, !!exId)
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
      <Link to={`/alunos/${alunoId}`} className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text mb-4">
        <ArrowLeft size={16} /> {aluno?.nome ?? 'Aluno'}
      </Link>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <TrendingUp size={20} className="text-accent-hover" /> Evolução
        </h2>
        {resumo && (
          <Button variant="outline" size="sm" onClick={exportarPdf} disabled={exporting}>
            <span className="flex items-center gap-1"><FileDown size={14} /> {exporting ? 'Gerando…' : 'Exportar PDF'}</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard icon={<CalendarCheck />} label="Sessões totais" value={resumo?.total_sessoes ?? 0} tone="accent" />
        <StatCard icon={<BarChart3 />} label="Volume total (kg)" value={Math.round(resumo?.total_volume ?? 0).toLocaleString('pt-BR')} tone="energy" />
        <StatCard icon={<Activity />} label="Sessões esta semana" value={resumo?.sessoes_semana ?? 0} tone="success" />
      </div>

      {semanas.length > 0 && (
        <Card variant="elevated" className="mb-4">
          <p className="text-sm text-text-secondary mb-3">Volume por semana</p>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={semanas} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="semana" tick={axisTick} stroke="var(--color-border-strong)" />
              <YAxis tick={axisTick} stroke="var(--color-border-strong)" />
              <Tooltip contentStyle={chartTip} />
              <Bar dataKey="volume" fill="var(--color-accent)" radius={[6, 6, 0, 0]} name="Volume (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {resumo?.prs?.length ? (
        <Card variant="elevated" className="mb-6">
          <p className="text-sm text-text-secondary mb-2 flex items-center gap-1"><Trophy size={14} className="text-energy" /> Recordes</p>
          <div className="flex flex-wrap gap-2">
            {resumo.prs.map((p) => (
              <Badge key={p.exercicio} tone="warning">{p.exercicio}: <b className="ml-1">{p.carga} kg</b></Badge>
            ))}
          </div>
        </Card>
      ) : null}

      <h3 className="text-sm font-medium text-text-secondary mb-2">Carga por exercício</h3>
      {!exercicios?.length ? (
        <EmptyState icon={<Activity />} title="Sem exercícios" description="Cadastre exercícios para acompanhar a evolução." />
      ) : (
        <>
          <Select value={exId} onChange={(e) => setExId(e.target.value)} className="mb-4 max-w-xs">
            {exercicios.map((ex) => (
              <option key={ex.exercicio_id} value={ex.exercicio_id}>{ex.nome}</option>
            ))}
          </Select>

          {isLoading ? (
            <Spinner />
          ) : !chartData.length ? (
            <p className="text-text-muted text-sm">Sem registros com carga numérica ainda.</p>
          ) : (
            <Card variant="elevated">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-text-secondary">Carga máxima por sessão</p>
                <Badge tone="warning"><Trophy size={12} /> PR {evo?.pr?.carga ?? '—'} kg</Badge>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <defs>
                    <linearGradient id="cargaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="data" tick={axisTick} stroke="var(--color-border-strong)" />
                  <YAxis tick={axisTick} stroke="var(--color-border-strong)" />
                  <Tooltip contentStyle={chartTip} />
                  {!isNaN(prescrita) && (
                    <ReferenceLine y={prescrita} stroke="var(--color-text-muted)" strokeDasharray="4 4"
                      label={{ value: `prescrita ${prescrita}`, fill: 'var(--color-text-muted)', fontSize: 11, position: 'insideTopRight' }} />
                  )}
                  <Area type="monotone" dataKey="carga" stroke="var(--color-accent)" strokeWidth={2.5}
                    fill="url(#cargaGradient)" dot={{ r: 3, fill: 'var(--color-accent)' }} name="Carga (kg)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="mt-4">
            <MediaTimeline items={(midias ?? []).map((m) => ({ ...m, ator: m.ator ?? 'ALUNO' }))} isLoading={midiasLoading} />
          </div>
        </>
      )}
    </div>
  )
}
