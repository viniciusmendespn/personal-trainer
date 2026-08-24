import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Trophy, TrendingUp, Activity, BarChart3, CalendarCheck, FileDown, MessageSquareDot, MessageCircle, Zap } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAluno } from '../hooks/useAlunos'
import { useExerciciosAlunoHistorico, useEvolucaoPorChave, useResumo } from '../hooks/useEvolucao'
import { Card, Spinner, StatCard, Badge, EmptyState, Button, SearchableSelect, useToast } from '../components/ui'
import { ExercicioFeedCard } from '../components/exercicio/ExercicioFeedCard'
import { RecordesList } from '../components/evolucao/RecordesList'
import { evolucaoApi } from '../api/evolucao'
import { fmtScoreValor } from '../utils/wod'
import { PostComposer } from '../components/exercicio/PostComposer'
import { TreinoDoDiaModal } from '../components/historico/TreinoDoDiaModal'
import { RelatorioPrintLayout } from '../components/pdf/RelatorioPrintLayout'
import { renderNodeToPdf } from '../utils/exportPdf'
import { treinosApi } from '../api/treinos'
import { personalApi } from '../api/personal'
import { normalizeTipoExercicio } from '../types'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: 'var(--color-text)',
  fontSize: 12,
}
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 12 }
const PALETA_GRUPOS = [
  'var(--color-accent)', 'var(--color-energy)', 'var(--color-success)',
  'var(--color-warning)', 'var(--color-danger)', 'var(--color-info)',
]

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
  // Pode ser a chave canônica (notifs novas) ou um exercicio_id legado — resolvido no efeito.
  const highlightRef = searchParams.get('highlight') ?? undefined
  const { data: aluno } = useAluno(alunoId)
  const { data: myProfile } = useQuery({ queryKey: ['personal-profile'], queryFn: personalApi.getProfile })
  const { data: exercicios } = useExerciciosAlunoHistorico(alunoId)
  const { data: resumo } = useResumo(alunoId)
  const [exKey, setExKey] = useState('')
  const [aba, setAba] = useState<AbaEvolucao>('feed')
  const [exporting, setExporting] = useState(false)
  const [salvandoPr, setSalvandoPr] = useState(false)
  const { show } = useToast()
  const qc = useQueryClient()

  /** Corrigir/apagar recorde não mexe nos REG, mas o `pr` da evolução passa a sair do item
   *  editado — por isso o gráfico e o bloco "histórico" também precisam recarregar. */
  async function aplicarNoPr(acao: () => Promise<unknown>, erro: string) {
    setSalvandoPr(true)
    try {
      await acao()
      qc.invalidateQueries({ queryKey: ['resumo', alunoId] })
      qc.invalidateQueries({ queryKey: ['evolucao-chave', alunoId] })
      qc.invalidateQueries({ queryKey: ['evolucao', alunoId] })
    } catch {
      show(erro, 'error')
    } finally {
      setSalvandoPr(false)
    }
  }

  const exerciciosOrdenados = useMemo(
    () => [...(exercicios ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [exercicios]
  )
  const exerciciosOptions = useMemo(
    () => exerciciosOrdenados.map((e) => ({ value: e.chave, label: e.nome })),
    [exerciciosOrdenados]
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

  const appliedHighlightRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!exerciciosOrdenados.length) return
    if (highlightRef && appliedHighlightRef.current !== highlightRef) {
      // Resolve chave OU exercicio_id legado; se o exercício sumiu, cai no primeiro da
      // lista — o select nunca fica em branco.
      // Aplicado uma única vez por highlightRef para não sobrescrever a troca manual do select.
      appliedHighlightRef.current = highlightRef
      const hit = exerciciosOrdenados.find((e) => e.chave === highlightRef)
        ?? exerciciosOrdenados.find((e) => e.exercicio_ids?.includes(highlightRef))
      setExKey(hit?.chave ?? exerciciosOrdenados[0].chave)
      setAba('feed')
      return
    }
    if (!exKey) setExKey(exerciciosOrdenados[0].chave)
  }, [exerciciosOrdenados, exKey, highlightRef])

  const { data: evo, isLoading } = useEvolucaoPorChave(alunoId, exKey)
  const { data: feed } = useQuery({
    queryKey: ['feed-exercicio', alunoId, exKey],
    queryFn: () => treinosApi.feedExercicioPorChave(alunoId, exKey),
    enabled: !!exKey && aba === 'feed',
  })
  const exSel = exercicios?.find((e) => e.chave === exKey)
  const tipoEvo = normalizeTipoExercicio(evo?.tipo ?? exSel?.tipo_exercicio)
  const unidadePerf = exSel?.unidade_reps || ''
  const prescrita = exSel?.carga_prescrita ? Number(String(exSel.carga_prescrita).replace(',', '.')) : NaN
  const isWod = !!exSel?.wod || exKey.startsWith('wod#')
  const fmtValor = (v: number) => isWod
    ? fmtScoreValor(exSel?.formato, v)
    : tipoEvo === 'PERFORMANCE' ? `${v} ${unidadePerf}`.trimEnd() : `${v} ${exSel?.unidade_carga ?? 'kg'}`

const chartData = (evo?.serie ?? [])
    .filter((p) => (tipoEvo === 'PERFORMANCE' ? p.metrica_max != null : p.carga_max != null))
    .map((p) => ({
      data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      valor: tipoEvo === 'PERFORMANCE' ? p.metrica_max : p.carga_max,
    }))

  const pontosIrm = tipoEvo === 'FORCA'
    ? (evo?.serie ?? [])
        .filter((p) => p.irm != null)
        .map((p) => ({
          data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          irm: p.irm as number,
        }))
    : []

  const semanas = useMemo(
    () => (resumo?.semanas ?? []).map((w) => ({ semana: w.semana.replace(/^\d+-/, ''), volume: w.volume })),
    [resumo]
  )

  const gruposNomes = useMemo(() => {
    if (resumo?.volume_por_grupo?.length) return resumo.volume_por_grupo.map((g) => g.grupo)
    const set = new Set<string>()
    for (const w of resumo?.semanas ?? []) Object.keys(w.grupos ?? {}).forEach((g) => set.add(g))
    return Array.from(set)
  }, [resumo])

  const semanasPorGrupo = useMemo(
    () => (resumo?.semanas ?? []).map((w) => ({
      semana: w.semana.replace(/^\d+-/, ''),
      ...Object.fromEntries(gruposNomes.map((g) => [g, w.grupos?.[g] ?? 0])),
    })),
    [resumo, gruposNomes]
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

          {/* Aba Carga / Evolução por exercício */}
          {aba === 'carga' && (
            <>
              <SearchableSelect
                options={exerciciosOptions}
                value={exKey}
                onChange={setExKey}
                placeholder="Buscar exercício…"
                className="mb-4 max-w-xs"
              />
              {isLoading ? (
                <Spinner />
              ) : !chartData.length ? (
                <p className="text-text-muted text-sm">
                  {tipoEvo === 'PERFORMANCE' ? 'Sem registros ainda.' : 'Sem registros com carga numérica ainda.'}
                </p>
              ) : (
                <>
                  <Card variant="elevated">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-text-secondary">
                        {isWod
                          ? `Score por execução${evo?.direcao === 'MENOR' ? ' · menor é melhor' : ''}`
                          : tipoEvo === 'PERFORMANCE'
                            ? `${unidadePerf || 'Métrica'} por sessão${evo?.direcao === 'MENOR' ? ' · menor é melhor' : ''}`
                            : 'Carga máxima por sessão'}
                      </p>
                      <Badge tone="warning">
                        <Trophy size={12} />
                        {' PR '}
                        {evo?.pr?.carga != null ? fmtValor(evo.pr.carga) : '—'}
                      </Badge>
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
                        <YAxis
                          tick={axisTick}
                          stroke="var(--color-border-strong)"
                        />
                        <Tooltip
                          contentStyle={chartTip}
                          formatter={(v: number) => [
                            fmtValor(v),
                            isWod ? 'Score' : tipoEvo === 'PERFORMANCE' ? (unidadePerf || 'Métrica') : (exSel?.unidade_carga ?? 'kg'),
                          ]}
                        />
                        {tipoEvo === 'FORCA' && !isNaN(prescrita) && (
                          <ReferenceLine y={prescrita} stroke="var(--color-text-muted)" strokeDasharray="4 4"
                            label={{ value: `prescrita ${prescrita}`, fill: 'var(--color-text-muted)', fontSize: 11, position: 'insideTopRight' }} />
                        )}
                        <Area type="monotone" dataKey="valor" stroke="var(--color-accent)" strokeWidth={2.5}
                          fill="url(#cargaGradient)" dot={{ r: 3, fill: 'var(--color-accent)' }}
                          name={tipoEvo === 'PERFORMANCE' ? (unidadePerf || 'Métrica') : 'Carga (kg)'} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                  {pontosIrm.length > 0 && (
                    <Card variant="elevated" className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-text-secondary flex items-center gap-1.5">
                          <Zap size={14} className="text-energy" /> IRM — Intensidade Relativa Média
                        </p>
                        <Badge tone="neutral">
                          último: {pontosIrm.at(-1)?.irm.toFixed(1)}%
                        </Badge>
                      </div>
                      <ResponsiveContainer width="100%" height={140}>
                        <AreaChart data={pontosIrm} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                          <defs>
                            <linearGradient id="irmGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-energy)" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="var(--color-energy)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="data" tick={axisTick} stroke="var(--color-border-strong)" />
                          <YAxis
                            domain={['auto', 'auto']}
                            tick={axisTick}
                            stroke="var(--color-border-strong)"
                            tickFormatter={(v: number) => `${v}%`}
                            width={42}
                          />
                          <Tooltip
                            contentStyle={chartTip}
                            formatter={(v: number) => [`${v.toFixed(1)}%`, 'IRM']}
                          />
                          <Area type="monotone" dataKey="irm" stroke="var(--color-energy)" strokeWidth={2.5}
                            fill="url(#irmGradient)" dot={{ r: 3, fill: 'var(--color-energy)' }} name="IRM (%)" />
                        </AreaChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-text-muted mt-2">
                        Média ponderada pelas repetições de intensidade relativa ao 1RM cadastrado ({exSel?.rm_kg} kg).
                      </p>
                    </Card>
                  )}
                </>
              )}
            </>
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

          {/* Volume por grupo muscular (empilhado por semana) */}
          {aba === 'volume' && gruposNomes.length > 0 && (
            <Card variant="elevated" className="mt-3">
              <p className="text-sm text-text-secondary mb-3">Volume por grupo muscular (kg)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={semanasPorGrupo} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="semana" tick={axisTick} stroke="var(--color-border-strong)" />
                  <YAxis tick={axisTick} stroke="var(--color-border-strong)" />
                  <Tooltip contentStyle={chartTip} />
                  {gruposNomes.map((g, i) => (
                    <Bar key={g} dataKey={g} stackId="grupo" fill={PALETA_GRUPOS[i % PALETA_GRUPOS.length]} name={g} radius={i === gruposNomes.length - 1 ? [6, 6, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Aba Recordes */}
          {aba === 'recordes' && (
            <RecordesList
              prs={resumo?.prs ?? []}
              exercicios={exercicios}
              salvando={salvandoPr}
              onSalvar={(chave, carga) =>
                aplicarNoPr(() => evolucaoApi.atualizarPr(alunoId, chave, carga), 'Não foi possível corrigir o recorde.')}
              onExcluir={(chave) =>
                aplicarNoPr(() => evolucaoApi.excluirPr(alunoId, chave), 'Não foi possível apagar o recorde.')}
            />
          )}

          {/* Aba Feed */}
          {aba === 'feed' && (
            <div className="space-y-3">
              <SearchableSelect
                options={exerciciosOptions}
                value={exKey}
                onChange={setExKey}
                placeholder="Buscar exercício…"
                className="max-w-xs"
              />
              {!!exSel && (
                <PostComposer
                  exercicioId={exSel.exercicio_id ?? undefined}
                  exercicioNome={exSel.nome}
                  viewerAtor="PERSONAL"
                  alunoId={alunoId}
                  onSuccess={() => qc.invalidateQueries({ queryKey: ['feed-exercicio', alunoId, exKey] })}
                />
              )}
              {!!exKey && (
                <p className="text-sm font-semibold text-text-secondary flex items-center gap-1.5">
                  <MessageSquareDot size={15} className="text-accent-hover" /> Feed do exercício
                </p>
              )}
              <ExercicioFeedCard
                items={feed?.items ?? []}
                emptyText="Nenhuma postagem ainda."
                viewerAtor="PERSONAL"
                alunoNome={aluno?.nome}
                alunoFotoUrl={aluno?.foto_url}
                personalNome={myProfile?.nome}
                personalFotoUrl={myProfile?.foto_url}
                renderTreinoDoDia={(a) => <TreinoDoDiaModal alunoId={alunoId} {...a} destaqueChave={exKey} />}
                uploadMidia={async (file) => {
                  const { upload_url, s3_key } = await treinosApi.uploadUrlMidia(alunoId, file.name, file.type)
                  await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
                  return { s3_key, tipo: file.type.startsWith('video') ? 'video_correcao' : 'foto_correcao' }
                }}
                onAddComentario={async (relatoSk, texto, midias, postTipo) => {
                  try {
                    if (relatoSk.startsWith('POST#')) {
                      await treinosApi.comentarPost(alunoId, { post_sk: relatoSk, texto, midias, post_tipo: postTipo })
                    } else {
                      await treinosApi.comentarRelato(alunoId, { relato_sk: relatoSk, texto, midias })
                    }
                    qc.invalidateQueries({ queryKey: ['feed-exercicio', alunoId, exKey] })
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
