import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Trophy, TrendingUp, Activity, BarChart3, CalendarCheck, FileDown, Search, MessageSquareDot, MessageCircle } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAluno } from '../hooks/useAlunos'
import { useExerciciosAluno, useEvolucao, useResumo } from '../hooks/useEvolucao'
import { Card, Spinner, StatCard, Badge, EmptyState, Button, Input, SearchableSelect, useToast } from '../components/ui'
import { ExercicioFeedCard } from '../components/exercicio/ExercicioFeedCard'
import { PostComposer } from '../components/exercicio/PostComposer'
import { RelatorioPrintLayout } from '../components/pdf/RelatorioPrintLayout'
import { renderNodeToPdf } from '../utils/exportPdf'
import { treinosApi } from '../api/treinos'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: 'var(--color-text)',
  fontSize: 12,
}
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 12 }

type AbaEvolucao = 'carga' | 'volume' | 'recordes' | 'feed'

const ABA_EVOLUCAO: { key: AbaEvolucao; label: string; icon: React.ReactNode }[] = [
  { key: 'feed', label: 'Feed', icon: <MessageCircle size={13} /> },
  { key: 'carga', label: 'Carga', icon: <TrendingUp size={13} /> },
  { key: 'volume', label: 'Volume', icon: <BarChart3 size={13} /> },
  { key: 'recordes', label: 'Recordes', icon: <Trophy size={13} /> },
]

export function AlunoEvolucaoPage() {
  const { alunoId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const highlightExId = searchParams.get('highlight') ?? undefined
  const { data: aluno } = useAluno(alunoId)
  const { data: exercicios } = useExerciciosAluno(alunoId)
  const { data: resumo } = useResumo(alunoId)
  const [exId, setExId] = useState(highlightExId ?? '')
  const [aba, setAba] = useState<AbaEvolucao>('feed')
  const [exporting, setExporting] = useState(false)
  const [prQuery, setPrQuery] = useState('')
  const [prLimit, setPrLimit] = useState(12)
  const { show } = useToast()
  const qc = useQueryClient()

  const exerciciosOrdenados = useMemo(
    () => [...(exercicios ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [exercicios]
  )
  const exerciciosOptions = useMemo(
    () => exerciciosOrdenados.map((e) => ({ value: e.exercicio_id, label: e.nome })),
    [exerciciosOrdenados]
  )
  const prsFiltrados = useMemo(
    () => (resumo?.prs ?? []).filter((p) => p.exercicio.toLowerCase().includes(prQuery.toLowerCase())),
    [resumo, prQuery]
  )

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
    if (highlightExId) { setExId(highlightExId); setAba('feed'); return }
    if (!exId && exerciciosOrdenados.length) setExId(exerciciosOrdenados[0].exercicio_id)
  }, [exerciciosOrdenados, exId, highlightExId])

  const { data: evo, isLoading } = useEvolucao(alunoId, exId)
  const { data: feed } = useQuery({
    queryKey: ['feed-exercicio', alunoId, exId],
    queryFn: () => treinosApi.feedExercicio(alunoId, exId),
    enabled: !!exId && aba === 'feed',
  })
  const exSel = exercicios?.find((e) => e.exercicio_id === exId)
  const prescrita = exSel?.carga_prescrita ? Number(String(exSel.carga_prescrita).replace(',', '.')) : NaN

  const chartData = (evo?.serie ?? [])
    .filter((p) => p.carga_max != null)
    .map((p) => ({
      data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      carga: p.carga_max,
    }))

  const semanas = useMemo(
    () => (resumo?.semanas ?? []).map((w) => ({ semana: w.semana.replace(/^\d+-/, ''), volume: w.volume })),
    [resumo]
  )

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

      {!exercicios?.length ? (
        <EmptyState icon={<Activity />} title="Sem exercícios" description="Cadastre exercícios para acompanhar a evolução." />
      ) : (
        <>
          {/* Seletor de exercício */}
          <SearchableSelect
            options={exerciciosOptions}
            value={exId}
            onChange={setExId}
            placeholder="Buscar exercício…"
            className="mb-4 max-w-xs"
          />

          {/* Abas */}
          <div className="flex gap-1 border-b border-border mb-4">
            {ABA_EVOLUCAO.map((a) => (
              <button
                key={a.key}
                onClick={() => setAba(a.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                  aba === a.key
                    ? 'border-accent text-accent-hover bg-accent/5'
                    : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          {/* Aba Carga */}
          {aba === 'carga' && (
            isLoading ? (
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
            )
          )}

          {/* Aba Volume */}
          {aba === 'volume' && (
            !semanas.length ? (
              <p className="text-text-muted text-sm">Sem dados de volume ainda.</p>
            ) : (
              <Card variant="elevated">
                <p className="text-sm text-text-secondary mb-3">Volume por semana (kg)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={semanas} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="semana" tick={axisTick} stroke="var(--color-border-strong)" />
                    <YAxis tick={axisTick} stroke="var(--color-border-strong)" />
                    <Tooltip contentStyle={chartTip} />
                    <Bar dataKey="volume" fill="var(--color-accent)" radius={[6, 6, 0, 0]} name="Volume (kg)" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )
          )}

          {/* Aba Recordes */}
          {aba === 'recordes' && (
            !(resumo?.prs?.length) ? (
              <p className="text-text-muted text-sm">Nenhum recorde ainda.</p>
            ) : (
              <Card variant="elevated">
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <Input placeholder="Buscar exercício…" value={prQuery} onChange={(e) => setPrQuery(e.target.value)} className="pl-8" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {prsFiltrados.slice(0, prLimit).map((p) => (
                    <Badge key={p.exercicio} tone="warning">{p.exercicio}: <b className="ml-1">{p.carga} kg</b></Badge>
                  ))}
                </div>
                {prsFiltrados.length > prLimit && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPrLimit((n) => n + 12)}>
                    Carregar mais ({prsFiltrados.length - prLimit} restantes)
                  </Button>
                )}
              </Card>
            )
          )}

          {/* Aba Feed */}
          {aba === 'feed' && (
            <div className="space-y-3">
              {!!exId && (
                <PostComposer
                  exercicioId={exId}
                  exercicioNome={exSel?.nome}
                  viewerAtor="PERSONAL"
                  alunoId={alunoId}
                  onSuccess={() => qc.invalidateQueries({ queryKey: ['feed-exercicio', alunoId, exId] })}
                />
              )}
              {!!exId && (
                <p className="text-sm font-semibold text-text-secondary flex items-center gap-1.5">
                  <MessageSquareDot size={15} className="text-accent-hover" /> Feed do exercício
                </p>
              )}
              <ExercicioFeedCard
                items={feed ?? []}
                emptyText="Nenhuma postagem ainda."
                viewerAtor="PERSONAL"
                uploadMidia={async (file) => {
                  const { upload_url, s3_key } = await treinosApi.uploadUrlMidia(alunoId, file.name, file.type)
                  await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
                  return { s3_key, tipo: file.type.startsWith('video') ? 'video_correcao' : 'foto_correcao' }
                }}
                onAddComentario={async (relatoSk, texto, midias) => {
                  try {
                    if (relatoSk.startsWith('POST#')) {
                      await treinosApi.comentarPost(alunoId, { post_sk: relatoSk, texto, midias })
                    } else {
                      await treinosApi.comentarRelato(alunoId, { relato_sk: relatoSk, texto, midias })
                    }
                    qc.invalidateQueries({ queryKey: ['feed-exercicio', alunoId, exId] })
                  } catch {
                    show('Não foi possível enviar o comentário.', 'error')
                  }
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
