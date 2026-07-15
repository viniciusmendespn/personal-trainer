import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, Pencil, TrendingUp, Scale, Send, Copy, Dumbbell, LayoutTemplate, ListChecks, StickyNote, Camera, RefreshCw, AlertCircle, Power, PowerOff, Bot, ClipboardList, CalendarDays, List, Video, Clock, AlarmClock, MessageCircle } from 'lucide-react'
import { useAluno, useAlunos, useUpdateAluno, useDeleteAluno } from '../hooks/useAlunos'
import { alunosApi } from '../api/alunos'
import { wapiApi } from '../api/wapi'
import { anamneseApi } from '../api/anamnese'
import {
  useTreinos, useCreateTreino, useUpdateTreino, useDeleteTreino,
  useExercicios, useCreateExercicio, useUpdateExercicio, useDeleteExercicio, useMidiaExercicio,
} from '../hooks/useTreinos'
import { Button, Card, Input, Textarea, Spinner, Tabs, Badge, Modal, ErrorText, useToast, useConfirm, AvatarUpload, Avatar, ObjetivosPicker, AutocompleteInput, StatChip, OverflowMenu, ExpandableText, SortableList, type SortableRenderProps } from '../components/ui'
import { PhoneInput } from '../components/PhoneInput'
import { MontarTreinoIaCallout } from '../components/MontarTreinoIaCallout'
import { AtualizarTreinoIAModal } from '../components/AtualizarTreinoIAModal'
import { MediaTimeline } from '../components/media/MediaTimeline'
import { useBiblioteca } from '../hooks/useDominio'
import { useExerciciosAluno, useEvolucao, useHistoricoExercicio } from '../hooks/useEvolucao'
import { useCreateTemplateFromTreino } from '../hooks/useTemplates'
import { useCreateRotinaFromAluno, useRotinas, useAplicarRotina } from '../hooks/useRotinas'
import { useNotas, useCreateNota } from '../hooks/useNotas'
import { treinosApi } from '../api/treinos'
import { SeriesPrescritasEditor, SeriesPrescritasCompact, initSeriesPrescritas } from '../components/exercicios/SeriesPrescritasEditor'
import { LinksUteisSelector } from '../components/exercicios/LinksUteisSelector'
import { LinksUteisIncluirSelector } from '../components/exercicios/LinksUteisIncluirSelector'
import { SubstitutosTreinoEditor } from '../components/exercicios/SubstitutosTreinoEditor'
import { BlocosTreinoEditor, formatoBlocoLabel, sufixoPrescricaoBloco, fmtPrescricaoBloco } from '../components/exercicios/BlocosTreinoEditor'
import { IntervaloInput } from '../components/exercicios/IntervaloInput'
import { SessaoDetalheCard } from '../components/historico/SessaoDetalheCard'
import { CalendarioMes } from '../components/historico/CalendarioMes'
import { FeriasPanel } from '../components/historico/FeriasPanel'
import { HistoricoLista } from '../components/historico/HistoricoLista'
import { usePersonalTimeline } from '../hooks/usePersonalTimeline'
import { feriasApi } from '../api/ferias'
import { feriasSobrepostas, formatDiaMes } from '../utils/ferias'
import type { Treino, Exercicio, ExercicioCreate, ExercicioSubstituto, SeriePrescrita, TipoExercicio, MetricaDirecao, AlunoExistenteConflict, Aluno, Rotina, AplicarRotinaModo, BlocoTreino } from '../types'
import { normalizeTipoExercicio } from '../types'
import { FrequenciaTab } from '../components/aluno/FrequenciaTab'
import { MetasTab } from '../components/aluno/MetasTab'
import { FinanceiroTab } from '../components/financeiro/FinanceiroTab'
import { videoUrlComFallback } from '../utils/video'
import { formatDuracao } from '../utils/datetime'

const TAB_KEYS = ['treinos', 'historico', 'frequencia', 'metas', 'financeiro', 'perfil'] as const
type TabKey = typeof TAB_KEYS[number]

/** Aviso informativo (não bloqueia) quando a vigência do treino cai num período de férias. */
function AvisoFeriasVigencia({ alunoId, dataInicio, dataFim }: { alunoId: string; dataInicio?: string; dataFim?: string }) {
  const { data: ferias = [] } = useQuery({
    queryKey: ['ferias', alunoId],
    queryFn: () => feriasApi.list(alunoId),
    staleTime: 60_000,
  })
  const conflitos = feriasSobrepostas(dataInicio, dataFim, ferias)
  if (conflitos.length === 0) return null
  const periodos = conflitos.map((f) => `${formatDiaMes(f.data_inicio)}–${formatDiaMes(f.data_fim)}`).join(', ')
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning">
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <span>A vigência deste treino cai em um período de férias/ausência do aluno ({periodos}). Apenas um aviso — você pode salvar mesmo assim.</span>
    </div>
  )
}

export function AlunoDetailPage() {
  const { alunoId = '' } = useParams()
  const navigate = useNavigate()
  const { data: aluno, error: alunoError } = useAluno(alunoId)
  const qc = useQueryClient()

  useEffect(() => {
    if (!aluno || aluno.foto_url) return
    alunosApi.syncFoto(alunoId).then(({ foto_url }) => {
      if (!foto_url) return
      qc.setQueryData<Aluno>(['aluno', alunoId], (prev) => prev ? { ...prev, foto_url } : prev)
      qc.invalidateQueries({ queryKey: ['alunos'] })
    }).catch(() => {})
  }, [aluno?.aluno_id, !!aluno?.foto_url]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: todosAlunos } = useAlunos()
  const objetivoSuggestions = useMemo(
    () => [...new Set((todosAlunos ?? []).flatMap((a) => a.objetivos ?? []))].sort(),
    [todosAlunos],
  )

  const { data: treinos, isLoading } = useTreinos(alunoId)
  const createTreino = useCreateTreino(alunoId)
  const updateAluno = useUpdateAluno(alunoId)
  const deleteAluno = useDeleteAluno()
  const confirm = useConfirm()
  // Aba ativa derivada da URL (?tab=…) — permite deep-link, ex.: /alunos/:id?tab=financeiro
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab') as TabKey | null
  const tab: TabKey = TAB_KEYS.includes(raw as TabKey) ? (raw as TabKey) : 'treinos'
  const setTab = (k: TabKey) => setSearchParams({ tab: k }, { replace: true })
  const [showAddTreino, setShowAddTreino] = useState(false)
  const [showAplicarRotina, setShowAplicarRotina] = useState(false)
  const [showAtualizarIA, setShowAtualizarIA] = useState(false)
  const salvarRotina = useCreateRotinaFromAluno()

  async function handleSalvarRotina() {
    if (!treinos?.length) {
      show('Adicione ao menos um treino antes de salvar a rotina.', 'error')
      return
    }
    const ok = await confirm({
      title: 'Salvar rotina',
      message: `Salvar os ${treinos.length} treinos de ${aluno?.nome ?? 'este aluno'} como uma rotina reutilizável? Cada treino também vira um template.`,
      confirmLabel: 'Salvar rotina',
    })
    if (!ok) return
    const r = await salvarRotina.mutateAsync({ alunoId, salvarTemplates: true })
    show(`Rotina salva (+${r.templates_criados} template${r.templates_criados === 1 ? '' : 's'}).`, 'success')
  }
  const [nome, setNome] = useState('')
  const [foco, setFoco] = useState('')
  const [dtIni, setDtIni] = useState('')
  const [dtFim, setDtFim] = useState('')
  const [novoBlocos, setNovoBlocos] = useState<BlocoTreino[]>([])
  const [editing, setEditing] = useState(false)
  const [eNome, setENome] = useState('')
  const [eTel, setETel] = useState('')
  const [eEmail, setEEmail] = useState('')
  const [eEndereco, setEEndereco] = useState('')
  const [eNascimento, setENascimento] = useState('')
  const [eObjs, setEObjs] = useState<string[]>([])
  const [eDescricao, setEDescricao] = useState('')
  const [editError, setEditError] = useState('')
  const [conflict, setConflict] = useState<AlunoExistenteConflict | null>(null)
  const reativarConflito = useUpdateAluno(conflict?.aluno_existente?.aluno_id ?? '')
  const { show } = useToast()
  const { data: linkData } = useQuery({
    queryKey: ['aluno-link', alunoId],
    queryFn: () => alunosApi.gerarLink(alunoId),
    enabled: !!alunoId,
  })
  const { data: wapiStatus } = useQuery({ queryKey: ['wapi-status'], queryFn: wapiApi.status, retry: false })
  const whatsConectado = wapiStatus?.connected === true
  const enviarLink = useMutation({
    mutationFn: () => alunosApi.enviarLink(alunoId),
    onSuccess: () => show('Link enviado pelo WhatsApp.', 'success'),
  })
  const novoToken = useMutation({
    mutationFn: () => alunosApi.novoToken(alunoId),
    onSuccess: (data) => {
      qc.setQueryData(['aluno-link', alunoId], { link: data.link })
      show('Novo link gerado. O link anterior não funciona mais.', 'success')
    },
    onError: () => show('Erro ao gerar novo link.', 'error'),
  })
  async function handleNovoToken() {
    const ok = await confirm({
      title: 'Gerar novo link',
      message: 'Ao gerar um novo link, o link anterior deixará de funcionar imediatamente. O aluno precisará usar o novo link para acessar o app.',
      confirmLabel: 'Gerar novo link',
      tone: 'danger',
    })
    if (!ok) return
    novoToken.mutate()
  }
  function copyLink() {
    if (!linkData?.link) return
    navigator.clipboard?.writeText(linkData.link)
    show('Link copiado!', 'success')
  }
  function handleEnviarLink() {
    if (whatsConectado) { enviarLink.mutate(); return }
    const tel = aluno?.telefone?.replace(/\D/g, '') ?? ''
    const telComDDI = tel.startsWith('55') ? tel : `55${tel}`
    const texto = encodeURIComponent(`Aqui está o link do seu app: ${linkData?.link ?? ''}`)
    window.open(`https://wa.me/${telComDDI}?text=${texto}`, '_blank', 'noopener')
  }

  function startEdit() {
    setENome(aluno?.nome ?? ''); setETel(aluno?.telefone ?? '')
    setEEmail(aluno?.email ?? ''); setEEndereco(aluno?.endereco ?? ''); setENascimento(aluno?.data_nascimento ?? '')
    setEObjs(aluno?.objetivos ?? []); setEDescricao(aluno?.descricao ?? '')
    setEditError(''); setConflict(null)
    setEditing(true)
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditError(''); setConflict(null)
    try {
      await updateAluno.mutateAsync({
        nome: eNome, telefone: eTel,
        email: eEmail || undefined, endereco: eEndereco || undefined,
        data_nascimento: eNascimento || undefined, objetivos: eObjs,
        descricao: eDescricao || undefined,
      })
      setEditing(false)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (detail?.code === 'PHONE_ALREADY_REGISTERED') {
        setConflict(detail)
      } else {
        setEditError(typeof detail === 'string' ? detail : 'Erro ao salvar aluno')
      }
    }
  }
  async function reativarExistente() {
    const alvo = conflict?.aluno_existente
    if (!alvo) return
    await reativarConflito.mutateAsync({ status: 'ATIVO' })
    navigate(`/alunos/${alvo.aluno_id}`)
  }
  async function remove() {
    const ok = await confirm({
      title: 'Excluir aluno',
      message: `Excluir ${aluno?.nome ?? 'este aluno'}? Treinos, histórico e mídias serão perdidos permanentemente.`,
      confirmLabel: 'Excluir', tone: 'danger',
    })
    if (!ok) return
    await deleteAluno.mutateAsync(alunoId)
    navigate('/alunos')
  }

  async function toggleStatus() {
    if (!aluno) return
    if (aluno.status === 'ATIVO') {
      const ok = await confirm({
        title: 'Desativar acesso',
        message: `${aluno.nome} perde acesso ao app imediatamente. Os dados são mantidos e o link continua o mesmo para quando reativar.`,
        confirmLabel: 'Desativar', tone: 'danger',
      })
      if (!ok) return
      await updateAluno.mutateAsync({ status: 'INATIVO' })
      show('Acesso desativado.', 'success')
    } else {
      await updateAluno.mutateAsync({ status: 'ATIVO' })
      show('Acesso reativado.', 'success')
    }
  }

  async function addTreino(e: React.FormEvent) {
    e.preventDefault()
    if (!nome) return
    await createTreino.mutateAsync({
      nome, foco: foco || undefined,
      data_inicio: dtIni || undefined, data_fim: dtFim || undefined,
      blocos: novoBlocos.filter((b) => b.nome.trim()),
      ordem: (treinos?.length ?? 0) + 1,
    })
    setNome(''); setFoco(''); setDtIni(''); setDtFim(''); setNovoBlocos([])
    setShowAddTreino(false)
  }

  const isBlocked = (alunoError as any)?.response?.data?.detail?.code === 'ALUNO_BLOCKED_BY_PLAN'
  if (isBlocked) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link to="/alunos" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text mb-4">
          <ArrowLeft size={16} /> Alunos
        </Link>
        <Card variant="elevated" className="space-y-3 mt-2">
          <p className="font-semibold text-text">Aluno bloqueado pelo plano</p>
          <p className="text-sm text-text-secondary">
            Limite de alunos do seu plano atingido. Este aluno não pode ser acessado até você renovar a assinatura.
          </p>
          <Link to="/plano" className="text-sm text-accent-hover hover:underline">Ver planos e renovar</Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/alunos" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text mb-4">
        <ArrowLeft size={16} /> Alunos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Avatar name={aluno?.nome ?? ''} imageUrl={aluno?.foto_url} size="lg" />
          <div>
            <h2 className="font-display text-xl font-semibold">{aluno?.nome ?? '…'}</h2>
            {aluno && <Badge tone={aluno.status === 'ATIVO' ? 'success' : 'neutral'} className="mt-1">{aluno.status}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={`/alunos/${alunoId}/evolucao`} className="inline-flex items-center gap-1 text-sm text-accent-hover hover:underline">
            <TrendingUp size={16} /> Evolução
          </Link>
          <Link to={`/alunos/${alunoId}/avaliacoes`} className="inline-flex items-center gap-1 text-sm text-accent-hover hover:underline">
            <Scale size={16} /> Avaliação
          </Link>
          {aluno && (
            <Button
              variant={aluno.status === 'ATIVO' ? 'outline' : 'energy'}
              size="sm"
              onClick={toggleStatus}
              disabled={updateAluno.isPending}
              className="gap-1.5 px-2.5 py-1.5 h-auto text-[9px] leading-tight items-center"
            >
              {aluno.status === 'ATIVO' ? <PowerOff size={13} className="shrink-0" /> : <Power size={13} className="shrink-0" />}
              <span className="text-left">{aluno.status === 'ATIVO' ? <>Desativar<br/>acesso</> : <>Ativar<br/>acesso</>}</span>
            </Button>
          )}
        </div>
      </div>

      {linkData && (
        <Card variant="elevated" className="mb-4">
          <p className="text-xs text-text-secondary mb-2">Link do app do aluno</p>
          <div className="flex items-center gap-2 mb-2">
            <input
              readOnly
              value={linkData.link}
              onFocus={(e) => e.target.select()}
              className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-surface border border-border text-text-secondary"
            />
            <Button variant="ghost" size="sm" iconOnly aria-label="Copiar link" onClick={copyLink}><Copy size={15} /></Button>
            <Button variant="ghost" size="sm" iconOnly aria-label="Enviar pelo WhatsApp" onClick={handleEnviarLink} disabled={enviarLink.isPending} title={whatsConectado ? 'Enviar pelo WhatsApp (automático)' : 'Abrir WhatsApp para enviar link'}><Send size={15} /></Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleNovoToken} disabled={novoToken.isPending} className="text-xs text-text-secondary gap-1">
            <RefreshCw size={13} />
            Gerar novo link
          </Button>
        </Card>
      )}

      <Tabs
        className="mb-4"
        tabs={[
          { key: 'treinos', label: 'Treinos' },
          { key: 'historico', label: 'Histórico' },
          { key: 'frequencia', label: 'Frequência' },
          { key: 'metas', label: 'Metas' },
          { key: 'financeiro', label: 'Financeiro' },
          { key: 'perfil', label: 'Perfil' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {tab === 'perfil' && (
        <div className="space-y-4">
        <Card variant="elevated">
          <div className="flex items-center gap-4 mb-4">
            <AvatarUpload
              name={aluno?.nome ?? '?'}
              currentUrl={aluno?.foto_url}
              size="lg"
              getUploadUrl={(filename, contentType) =>
                alunosApi.avatarUploadUrl(alunoId, filename, contentType)
              }
              onSuccess={(s3Key) =>
                updateAluno.mutate({ foto_s3_key: s3Key })
              }
              onError={() => show('Erro ao enviar foto.', 'error')}
            />
            <div>
              <p className="font-semibold text-text">{aluno?.nome}</p>
              {aluno?.descricao && <p className="text-xs text-text-secondary mt-0.5">{aluno.descricao}</p>}
            </div>
          </div>
          {editing ? (
            <form onSubmit={saveEdit} className="space-y-3">
              <Input label="Nome" value={eNome} onChange={(e) => setENome(e.target.value)} />
              <Input
                label="Descrição curta"
                value={eDescricao}
                onChange={(e) => setEDescricao(e.target.value)}
                placeholder="Ex.: Foco em hipertrofia"
              />
              <PhoneInput label="Telefone" value={eTel} onChange={setETel} />
              <Input label="E-mail" type="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} />
              <Input label="Data de nascimento" type="date" value={eNascimento} onChange={(e) => setENascimento(e.target.value)} />
              <Input label="Endereço" value={eEndereco} onChange={(e) => setEEndereco(e.target.value)} />
              <ObjetivosPicker label="Objetivos" value={eObjs} onChange={setEObjs} suggestions={objetivoSuggestions} />
              <ErrorText>{editError}</ErrorText>
              {conflict && (
                <Card variant="elevated" className="border-warning/40 space-y-2">
                  <p className="text-sm text-text-secondary">{conflict.message}</p>
                  {conflict.aluno_existente && (
                    conflict.aluno_existente.status === 'INATIVO' ? (
                      <Button type="button" size="sm" variant="energy" onClick={reativarExistente} disabled={reativarConflito.isPending}>
                        {reativarConflito.isPending ? 'Reativando…' : `Reativar ${conflict.aluno_existente.nome}`}
                      </Button>
                    ) : (
                      <Link
                        to={`/alunos/${conflict.aluno_existente.aluno_id}`}
                        className="text-sm text-accent-hover hover:underline"
                      >
                        Ver {conflict.aluno_existente.nome}
                      </Link>
                    )
                  )}
                </Card>
              )}
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={updateAluno.isPending}>Salvar</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button type="button" variant="danger" onClick={remove} className="ml-auto">Excluir</Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-muted">Telefone</p>
                <p className="text-sm">{aluno?.telefone}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">E-mail</p>
                <p className="text-sm">{aluno?.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Data de nascimento</p>
                <p className="text-sm">{aluno?.data_nascimento ? fmtDateFull(aluno.data_nascimento) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Endereço</p>
                <p className="text-sm">{aluno?.endereco || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Objetivos</p>
                {aluno?.objetivos?.length ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {aluno.objetivos.map((obj) => (
                      <span key={obj} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent-hover border border-accent/30">
                        {obj}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm">—</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={startEdit}>
                <span className="flex items-center gap-1"><Pencil size={14} /> Editar perfil</span>
              </Button>
            </div>
          )}
        </Card>
        <QuestionarioSaudeCard alunoId={alunoId} />
        <NotasTimeline alunoId={alunoId} />
        </div>
      )}

      {tab === 'treinos' && (
        <>
          <div className="flex flex-wrap justify-end gap-2 mb-4">
            <Button variant="outline" onClick={() => setShowAplicarRotina(true)}>
              <span className="flex items-center gap-1"><ListChecks size={16} /> Aplicar rotina</span>
            </Button>
            {treinos && treinos.length > 0 && (
              <Button variant="outline" onClick={handleSalvarRotina} disabled={salvarRotina.isPending}>
                <span className="flex items-center gap-1"><ListChecks size={16} /> {salvarRotina.isPending ? 'Salvando…' : 'Salvar rotina'}</span>
              </Button>
            )}
            {treinos && treinos.length > 0 && (
              <Button variant="outline" onClick={() => setShowAtualizarIA(true)}>
                <span className="flex items-center gap-1"><Bot size={16} /> Atualizar com IA</span>
              </Button>
            )}
            <Button onClick={() => setShowAddTreino(true)}>
              <span className="flex items-center gap-1"><Plus size={16} /> Adicionar treino</span>
            </Button>
          </div>

          <AtualizarTreinoIAModal
            open={showAtualizarIA}
            onClose={() => setShowAtualizarIA(false)}
            alunoId={alunoId}
            alunoNome={aluno?.nome}
          />

          <Modal open={showAplicarRotina} onClose={() => setShowAplicarRotina(false)} title="Aplicar rotina pronta">
            <AplicarRotinaNoAluno alunoId={alunoId} temTreinos={!!treinos?.length} onDone={() => setShowAplicarRotina(false)} />
          </Modal>

          <Modal open={showAddTreino} onClose={() => setShowAddTreino(false)} title="Novo treino" size="lg">
            <form onSubmit={addTreino} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Treino" placeholder="ex: Treino A" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
                <Input label="Foco" placeholder="ex: Inferiores" value={foco} onChange={(e) => setFoco(e.target.value)} />
                <Input label="Início" type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} />
                <Input label="Fim" type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} />
              </div>
              <AvisoFeriasVigencia alunoId={alunoId} dataInicio={dtIni} dataFim={dtFim} />
              <BlocosTreinoEditor value={novoBlocos} onChange={setNovoBlocos} />
              <Button type="submit" className="w-full" disabled={createTreino.isPending}>
                {createTreino.isPending ? 'Adicionando…' : 'Adicionar treino'}
              </Button>
            </form>
          </Modal>

          {isLoading ? (
            <Spinner />
          ) : !treinos?.length ? (
            <MontarTreinoIaCallout />
          ) : (
            <TreinosLista alunoId={alunoId} treinos={treinos} />
          )}
        </>
      )}

      {tab === 'historico' && <HistoricoPersonal alunoId={alunoId} />}
      {tab === 'frequencia' && <FrequenciaTab alunoId={alunoId} />}
      {tab === 'metas' && <MetasTab alunoId={alunoId} />}
      {tab === 'financeiro' && <FinanceiroTab alunoId={alunoId} />}
    </div>
  )
}

const fmtDate = (d?: string) => (d ? d.split('-').reverse().slice(0, 2).join('/') : '')
const fmtDateFull = (d?: string) => (d ? d.split('-').reverse().join('/') : '')
function TreinosLista({ alunoId, treinos }: { alunoId: string; treinos: Treino[] }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const isVigente = (t: Treino) => t.ativo !== false && (!t.data_fim || t.data_fim >= hoje)
  const expirados = treinos.filter((t) => !isVigente(t))
  const [vigentes, setVigentes] = useState<Treino[]>(() => treinos.filter(isVigente))
  useEffect(() => { setVigentes(treinos.filter(isVigente)) }, [treinos]) // eslint-disable-line react-hooks/exhaustive-deps
  const [showExpirados, setShowExpirados] = useState(false)
  const [reordering, setReordering] = useState(false)
  const updTreino = useUpdateTreino(alunoId)
  const [renovandoId, setRenovandoId] = useState<string | null>(null)
  const [novaDataFim, setNovaDataFim] = useState('')
  const { show } = useToast()

  const defaultDataFim = () => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  }

  async function reordenarTreinos(newList: Treino[]) {
    setVigentes(newList) // otimista
    setReordering(true)
    try {
      await Promise.all(
        newList
          .map((t, idx) => ({ t, idx }))
          .filter(({ t, idx }) => t.ordem !== idx)
          .map(({ t, idx }) =>
            updTreino.mutateAsync({
              treinoId: t.treino_id,
              body: {
                nome: t.nome, foco: t.foco, observacoes: t.observacoes,
                ativo: t.ativo, data_inicio: t.data_inicio, data_fim: t.data_fim,
                blocos: t.blocos, custom: t.custom, ordem: idx,
              },
            })
          )
      )
    } finally {
      setReordering(false)
    }
  }

  async function renovar(t: Treino) {
    setRenovandoId(t.treino_id)
    setNovaDataFim(defaultDataFim())
  }

  async function confirmarRenovacao(t: Treino) {
    await updTreino.mutateAsync({
      treinoId: t.treino_id,
      body: {
        nome: t.nome, ordem: t.ordem, foco: t.foco, observacoes: t.observacoes,
        ativo: true, data_inicio: t.data_inicio, data_fim: novaDataFim || undefined,
        blocos: t.blocos, custom: t.custom,
      },
    })
    show('Vigência renovada.', 'success')
    setRenovandoId(null)
  }

  return (
    <div className="space-y-3">
      <SortableList items={vigentes} getId={(t) => t.treino_id} onReorder={reordenarTreinos} disabled={reordering}>
        {(t, idx, p) => (
          <div ref={p.setNodeRef} style={p.style} className="flex items-start gap-1 mb-3">
            <div className="flex items-center gap-1 shrink-0 pt-2">
              {p.handle}
              <span className="text-[10px] font-mono text-text-muted w-4 text-center select-none">{idx + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <TreinoCard alunoId={alunoId} treino={t} />
            </div>
          </div>
        )}
      </SortableList>

      {expirados.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text py-1 transition-colors"
            onClick={() => setShowExpirados((v) => !v)}
          >
            {showExpirados ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <AlertCircle size={13} className="text-warning" />
            Treinos expirados ({expirados.length})
          </button>
          {showExpirados && (
            <div className="space-y-3 mt-2">
              {expirados.map((t) => (
                <TreinoCard key={t.treino_id} alunoId={alunoId} treino={t} expired onRenovar={() => renovar(t)} />
              ))}
            </div>
          )}
          {renovandoId && (
            <Modal open onClose={() => setRenovandoId(null)} title={`Renovar "${expirados.find(t => t.treino_id === renovandoId)?.nome ?? ''}"`} size="md">
              <div className="space-y-3">
                <Input
                  label="Nova data de término"
                  type="date"
                  value={novaDataFim}
                  onChange={(e) => setNovaDataFim(e.target.value)}
                />
                <Button className="w-full" disabled={updTreino.isPending} onClick={() => {
                  const t = expirados.find(t => t.treino_id === renovandoId)
                  if (t) confirmarRenovacao(t)
                }}>
                  {updTreino.isPending ? 'Salvando…' : 'Confirmar renovação'}
                </Button>
              </div>
            </Modal>
          )}
        </div>
      )}
    </div>
  )
}

function QuestionarioSaudeCard({ alunoId }: { alunoId: string }) {
  const { data: template, isLoading: loadingTemplate } = useQuery({
    queryKey: ['anamnese-template'],
    queryFn: anamneseApi.getTemplate,
  })
  const { data: resposta, isLoading: loadingResposta } = useQuery({
    queryKey: ['aluno-anamnese', alunoId],
    queryFn: () => anamneseApi.getAlunoAnamnese(alunoId),
  })

  const header = (
    <p className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-1">
      <ClipboardList size={14} /> Questionário de saúde
    </p>
  )

  if (loadingTemplate || loadingResposta) {
    return <Card variant="elevated">{header}<Spinner /></Card>
  }

  const perguntas = template?.perguntas ?? []
  if (perguntas.length === 0) {
    return (
      <Card variant="elevated">
        {header}
        <p className="text-xs text-text-muted">
          Nenhuma pergunta configurada. <Link to="/config?tab=anamnese" className="text-accent-hover hover:underline">Configurar perguntas</Link>
        </p>
      </Card>
    )
  }

  const respostas = resposta?.respostas ?? {}
  if (Object.keys(respostas).length === 0) {
    return (
      <Card variant="elevated">
        {header}
        <p className="text-xs text-text-muted">Aluno ainda não respondeu o questionário.</p>
      </Card>
    )
  }

  function formatValor(pergunta: { type: string }, valor: unknown) {
    if (valor === undefined || valor === null || valor === '') return '—'
    if (pergunta.type === 'BOOL') return valor === true ? 'Sim' : valor === false ? 'Não' : '—'
    if (pergunta.type === 'DATE') return fmtDateFull(String(valor))
    return String(valor)
  }

  const chavesConhecidas = new Set(perguntas.map((p) => p.key))
  const orfas = Object.entries(respostas).filter(([key]) => !chavesConhecidas.has(key))

  return (
    <Card variant="elevated">
      {header}
      <div className="space-y-3">
        {perguntas.map((p) => (
          <div key={p.key}>
            <p className="text-xs text-text-muted">{p.label}</p>
            <p className="text-sm">{formatValor(p, respostas[p.key])}</p>
          </div>
        ))}
        {orfas.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-text-muted mb-1.5">Outras respostas (pergunta removida ou alterada)</p>
            {orfas.map(([key, valor]) => (
              <div key={key}>
                <p className="text-xs text-text-muted">{key}</p>
                <p className="text-sm">{String(valor)}</p>
              </div>
            ))}
          </div>
        )}
        {resposta?.preenchido_em && (
          <p className="text-[11px] text-text-muted pt-1">
            Respondido por {resposta.preenchido_por === 'PERSONAL' ? 'personal' : 'aluno'} em {new Date(resposta.preenchido_em).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </Card>
  )
}

function NotasTimeline({ alunoId }: { alunoId: string }) {
  const { data: notas, isLoading } = useNotas(alunoId)
  const create = useCreateNota(alunoId)
  const [texto, setTexto] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    await create.mutateAsync(texto.trim())
    setTexto('')
  }

  return (
    <Card variant="elevated">
      <p className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-1">
        <StickyNote size={14} /> Anotações sobre o aluno
      </p>
      <form onSubmit={add} className="space-y-2 mb-3">
        <Textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nova anotação…" />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={create.isPending || !texto.trim()}>Adicionar</Button>
        </div>
      </form>
      {isLoading ? (
        <Spinner />
      ) : !notas?.length ? (
        <p className="text-xs text-text-muted">Nenhuma anotação ainda.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {notas.map((n) => (
            <div key={n.nota_id} className="border-b border-border pb-2">
              <p className="text-sm whitespace-pre-wrap">{n.texto}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{new Date(n.data_hora).toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** Reconstrói o corpo `ExercicioCreate` a partir de um `Exercicio` existente (para reordenar). */
function toExercicioCreate(ex: Exercicio): ExercicioCreate {
  return {
    nome: ex.nome, grupo: ex.grupo, ordem: ex.ordem, bloco_id: ex.bloco_id,
    aquecimento: ex.aquecimento, tipo_exercicio: ex.tipo_exercicio,
    unidade_carga: ex.unidade_carga, unidade_reps: ex.unidade_reps,
    metrica_direcao: ex.metrica_direcao, series: ex.series,
    reps_prescritas: ex.reps_prescritas, carga_prescrita: ex.carga_prescrita,
    series_prescritas: ex.series_prescritas, intervalo_s: ex.intervalo_s,
    video_url: ex.video_url, observacoes: ex.observacoes, rm_kg: ex.rm_kg,
    links_uteis: ex.links_uteis, links_uteis_excluidos: ex.links_uteis_excluidos,
    substitutos: ex.substitutos, substitutos_excluidos: ex.substitutos_excluidos,
    custom: ex.custom,
  }
}

function TreinoCard({ alunoId, treino, expired, onRenovar }: { alunoId: string; treino: Treino; expired?: boolean; onRenovar?: () => void }) {
  const [open, setOpen] = useState(false)
  const [editT, setEditT] = useState(false)
  const [addingEx, setAddingEx] = useState(false)
  const [reordering, setReordering] = useState(false)
  const delTreino = useDeleteTreino(alunoId)
  const updTreino = useUpdateTreino(alunoId)
  const updEx = useUpdateExercicio(alunoId, treino.treino_id)
  const saveAsTemplate = useCreateTemplateFromTreino()
  const { show } = useToast()
  const confirm = useConfirm()
  const { data: exs } = useExercicios(alunoId, open ? treino.treino_id : '')
  const { data: biblioteca } = useBiblioteca()
  const { data: exerciciosAluno } = useExerciciosAluno(alunoId)
  const createEx = useCreateExercicio(alunoId, treino.treino_id)

  // Cópia local dos exercícios para reordenação otimista (evita "pulo" enquanto persiste).
  const [exsLocal, setExsLocal] = useState<Exercicio[]>([])
  useEffect(() => { if (exs) setExsLocal(exs) }, [exs])

  // Grupos exibidos (por bloco, mais "Sem bloco"); usado no render e no reorder.
  const { ordenados, blocosSorted, groups } = useMemo(() => {
    const ord = [...exsLocal].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    const bs = (treino.blocos ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    const blocoIds = new Set(bs.map((b) => b.id))
    const semBloco = ord.filter((e) => !e.bloco_id || !blocoIds.has(e.bloco_id))
    const gs = bs.length
      ? [
          ...bs.map((b) => ({ key: b.id, bloco: b as BlocoTreino | undefined, items: ord.filter((e) => e.bloco_id === b.id) })),
          ...(semBloco.length ? [{ key: '__sem__', bloco: undefined as BlocoTreino | undefined, items: semBloco }] : []),
        ]
      : [{ key: '__all__', bloco: undefined as BlocoTreino | undefined, items: ord }]
    return { ordenados: ord, blocosSorted: bs, groups: gs }
  }, [exsLocal, treino.blocos])

  async function persistOrdemExercicios(newFlat: Exercicio[]) {
    const updated = newFlat.map((e, idx) => ({ ...e, ordem: idx }))
    setExsLocal(updated) // otimista
    setReordering(true)
    try {
      await Promise.all(
        updated
          .filter((e) => (ordenados.find((o) => o.exercicio_id === e.exercicio_id)?.ordem ?? 0) !== e.ordem)
          .map((e) => updEx.mutateAsync({ exercicioId: e.exercicio_id, body: { ...toExercicioCreate(e), ordem: e.ordem } })),
      )
    } finally {
      setReordering(false)
    }
  }
  /** Reordena dentro de um grupo (bloco) e recompõe a ordem global achatada. */
  function reordenarExerciciosGrupo(groupKey: string, newItems: Exercicio[]) {
    persistOrdemExercicios(groups.flatMap((g) => (g.key === groupKey ? newItems : g.items)))
  }
  const [tNome, setTNome] = useState(treino.nome)
  const [tFoco, setTFoco] = useState(treino.foco ?? '')
  const [tIni, setTIni] = useState(treino.data_inicio ?? '')
  const [tFim, setTFim] = useState(treino.data_fim ?? '')
  const [tBlocos, setTBlocos] = useState<BlocoTreino[]>(treino.blocos ?? [])

  async function addEx(body: ExercicioCreate) {
    await createEx.mutateAsync({ ...body, ordem: (exs?.length ?? 0) + 1 })
    setAddingEx(false)
  }

  async function salvarComoTemplate() {
    if (open && exs && exs.length === 0) {
      show('Este treino não tem exercícios — adicione ao menos um antes de salvar como template.', 'error')
      return
    }
    const ok = await confirm({
      title: 'Salvar como template',
      message: `Salvar "${treino.nome}" como template reutilizável? Você poderá aplicá-lo a outros alunos em "Templates".`,
      confirmLabel: 'Salvar',
    })
    if (!ok) return
    try {
      await saveAsTemplate.mutateAsync({ alunoId, treinoId: treino.treino_id, nome: treino.nome })
      show('Template salvo. Veja em "Templates".', 'success')
    } catch (err: any) {
      show(err?.response?.data?.detail ?? 'Não foi possível salvar o template.', 'error')
    }
  }

  async function removerTreino() {
    const ok = await confirm({
      title: 'Excluir treino',
      message: `Excluir "${treino.nome}"? Todos os exercícios e o histórico de execução desse treino serão perdidos.`,
      confirmLabel: 'Excluir', tone: 'danger',
    })
    if (ok) delTreino.mutate(treino.treino_id)
  }

  async function saveTreino(e: React.FormEvent) {
    e.preventDefault()
    await updTreino.mutateAsync({
      treinoId: treino.treino_id,
      body: {
        nome: tNome, foco: tFoco || undefined, data_inicio: tIni || undefined, data_fim: tFim || undefined,
        blocos: tBlocos.filter((b) => b.nome.trim()),
      },
    })
    setEditT(false)
  }

  return (
    <Card variant="elevated" className={expired ? 'opacity-70' : ''}>
      <div className="flex items-center justify-between gap-2">
        <button className="flex-1 min-w-0 overflow-hidden flex items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
          <span className="min-w-0 overflow-hidden">
            <ExpandableText as="span" text={treino.nome} className="font-medium block">{treino.nome}</ExpandableText>
            {(() => {
              const parts: string[] = []
              if (treino.foco) parts.push(treino.foco)
              const dateParts: string[] = []
              if (treino.data_inicio) dateParts.push(`de ${fmtDate(treino.data_inicio)}`)
              if (treino.data_fim) dateParts.push(`até ${fmtDate(treino.data_fim)}`)
              if (dateParts.length) parts.push(dateParts.join(' '))
              return parts.length > 0
                ? <ExpandableText text={parts.join(' · ')} className="text-xs text-text-muted block">{parts.join(' · ')}</ExpandableText>
                : null
            })()}
          </span>
        </button>
        <OverflowMenu
          ariaLabel="Ações do treino"
          items={[
            { icon: <LayoutTemplate size={14} />, label: 'Salvar template', onClick: salvarComoTemplate, disabled: saveAsTemplate.isPending },
            expired
              ? { icon: <RefreshCw size={14} />, label: 'Renovar vigência', onClick: () => onRenovar?.() }
              : { icon: <Pencil size={14} />, label: 'Editar treino', onClick: () => setEditT(true) },
            { icon: <Trash2 size={14} />, label: 'Excluir treino', tone: 'danger', onClick: removerTreino },
          ]}
        />
      </div>

      <Modal open={editT} onClose={() => setEditT(false)} title="Editar treino" size="lg">
        <form onSubmit={saveTreino} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Treino" value={tNome} onChange={(e) => setTNome(e.target.value)} autoFocus />
            <Input label="Foco" value={tFoco} onChange={(e) => setTFoco(e.target.value)} />
            <Input label="Início" type="date" value={tIni} onChange={(e) => setTIni(e.target.value)} />
            <Input label="Fim" type="date" value={tFim} onChange={(e) => setTFim(e.target.value)} />
          </div>
          <AvisoFeriasVigencia alunoId={alunoId} dataInicio={tIni} dataFim={tFim} />
          <BlocosTreinoEditor value={tBlocos} onChange={setTBlocos} />
          <Button type="submit" className="w-full" disabled={updTreino.isPending}>
            {updTreino.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </Modal>

      {open && (
        <div className="mt-3 pl-2 sm:pl-6 space-y-1">
          {(() => {
            const nMet = treino.sessoes_com_metrica ?? 0
            const tMedio = nMet > 0 && treino.soma_duracao_segundos ? formatDuracao(Math.round(treino.soma_duracao_segundos / nMet)) : null
            const somaSeries = treino.soma_total_series ?? 0
            const secSerie = nMet > 0 && somaSeries > 0 && treino.soma_duracao_segundos ? treino.soma_duracao_segundos / somaSeries : 0
            const tSerie = secSerie > 0 ? (secSerie < 60 ? `${Math.round(secSerie)}s` : `${(secSerie / 60).toFixed(1).replace('.', ',')}min`) : null
            const nExec = treino.total_execucoes ?? 0
            if (!nExec && !tMedio && !tSerie) return null
            return (
              <div className="flex flex-wrap gap-2 pb-1">
                {nExec > 0 && <StatChip icon={<TrendingUp size={12} />} tone="accent">{nExec}× executado</StatChip>}
                {tMedio && <StatChip>⏱ ~{tMedio} por execução</StatChip>}
                {tSerie && <StatChip>~{tSerie}/série <span className="opacity-70">(estim.)</span></StatChip>}
              </div>
            )
          })()}
          {(() => {
            const row = (ex: Exercicio, index: number, p: SortableRenderProps, bloco?: BlocoTreino) => (
              <ExercicioRow key={ex.exercicio_id} alunoId={alunoId} treinoId={treino.treino_id} ex={ex} index={index} biblioteca={biblioteca} exerciciosAluno={exerciciosAluno} blocos={treino.blocos} bloco={bloco} sortable={p} />
            )
            if (!blocosSorted.length) {
              return (
                <SortableList items={ordenados} getId={(e) => e.exercicio_id} onReorder={persistOrdemExercicios} disabled={reordering}>
                  {(ex, i, p) => row(ex, i + 1, p)}
                </SortableList>
              )
            }
            return groups.map((g) => (
              g.bloco?.descanso ? (
                <div key={g.key} className="flex items-center gap-2 my-2">
                  <AlarmClock size={12} className="text-accent shrink-0" />
                  <span className="text-xs font-medium text-text-secondary">{formatoBlocoLabel(g.bloco) ?? 'Descanso'}</span>
                </div>
              ) : (
              <div key={g.key}>
                {g.bloco ? (
                  <div className="flex items-center gap-2 mt-2 mb-1">
                    <span className="text-xs font-semibold text-text-secondary">{g.bloco.nome}</span>
                    {formatoBlocoLabel(g.bloco) && <Badge tone={g.bloco.aquecimento ? 'neutral' : 'accent'}>{formatoBlocoLabel(g.bloco)}</Badge>}
                  </div>
                ) : (
                  <div className="mt-2 mb-1"><span className="text-xs font-semibold text-text-secondary">Sem bloco</span></div>
                )}
                {g.items.length ? (
                  <SortableList items={g.items} getId={(e) => e.exercicio_id} onReorder={(ni) => reordenarExerciciosGrupo(g.key, ni)} disabled={reordering}>
                    {(ex, i, p) => row(ex, i + 1, p, g.bloco)}
                  </SortableList>
                ) : (
                  <p className="text-xs text-text-muted pl-2">Sem exercícios neste bloco.</p>
                )}
              </div>
              )
            ))
          })()}
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setAddingEx(true)}>
            <span className="flex items-center gap-1"><Plus size={14} /> Exercício</span>
          </Button>
        </div>
      )}

      <Modal open={addingEx} onClose={() => setAddingEx(false)} title="Novo exercício" size="lg">
        <ExercicioForm biblioteca={biblioteca} exerciciosAluno={exerciciosAluno} blocos={treino.blocos} submitLabel="Adicionar exercício" submitting={createEx.isPending} onSubmit={addEx} />
      </Modal>
    </Card>
  )
}

function ExercicioForm({
  initial, biblioteca, exerciciosAluno, blocos, onSubmit, submitting, submitLabel,
}: {
  initial?: Partial<Exercicio>
  biblioteca?: { exlib_id: string; nome: string; grupo?: string; video_url?: string; recomendacoes?: string; links_uteis?: string[]; substitutos?: ExercicioSubstituto[] }[]
  exerciciosAluno?: Exercicio[]
  blocos?: BlocoTreino[]
  onSubmit: (body: ExercicioCreate) => Promise<void>
  submitting?: boolean
  submitLabel: string
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [grupo, setGrupo] = useState(initial?.grupo ?? '')
  const [blocoId, setBlocoId] = useState(initial?.bloco_id ?? '')
  const [aquecimento, setAquecimento] = useState(!!initial?.aquecimento)
  const [tipo, setTipo] = useState<TipoExercicio>(normalizeTipoExercicio(initial?.tipo_exercicio))
  const [seriesPrescritas, setSeriesPrescritas] = useState<SeriePrescrita[]>(() =>
    initSeriesPrescritas(initial?.series_prescritas, initial?.series, initial?.reps_prescritas, initial?.carga_prescrita)
  )
  const [unidadeCarga, setUnidadeCarga] = useState(initial?.unidade_carga ?? '')
  const [unidadeReps, setUnidadeReps] = useState(initial?.unidade_reps ?? '')
  const [metricaDirecao, setMetricaDirecao] = useState<MetricaDirecao>(initial?.metrica_direcao ?? 'MAIOR')
  const [vid, setVid] = useState(initial?.video_url ?? '')
  const [obs, setObs] = useState(initial?.observacoes ?? '')
  const [intervaloS, setIntervaloS] = useState<number | undefined>(initial?.intervalo_s)
  const [rmKg, setRmKg] = useState<string>(initial?.rm_kg != null ? String(initial.rm_kg) : '')
  const [linksUteis, setLinksUteis] = useState<string[]>(initial?.links_uteis ?? [])
  const [linksUteisExcluidos, setLinksUteisExcluidos] = useState<string[]>(initial?.links_uteis_excluidos ?? [])
  const [substitutos, setSubstitutos] = useState<ExercicioSubstituto[]>(initial?.substitutos ?? [])
  const [substitutosExcluidos, setSubstitutosExcluidos] = useState<string[]>(initial?.substitutos_excluidos ?? [])

  const exerciciosAlunoUnicos = useMemo(() => {
    const porNome = new Map<string, Exercicio>()
    for (const e of exerciciosAluno ?? []) {
      const k = e.nome.toLowerCase()
      if (!porNome.has(k)) porNome.set(k, e)
    }
    return Array.from(porNome.values())
  }, [exerciciosAluno])

  const grupos = useMemo(
    () => Array.from(new Set([
      ...exerciciosAlunoUnicos.map((e) => e.grupo),
      ...(biblioteca ?? []).map((b) => b.grupo),
    ].filter((g): g is string => !!g))).sort(),
    [biblioteca, exerciciosAlunoUnicos]
  )

  const datalistNomes = useMemo(
    () => (biblioteca ?? [])
      .map((b) => ({ key: b.exlib_id, nome: b.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [biblioteca]
  )

  function onNome(v: string) {
    setNome(v)
    // Prioriza o uso anterior do próprio aluno (mais específico) sobre a biblioteca geral —
    // ao repetir o nome, a evolução é unificada automaticamente (agrupada por nome no backend).
    const usado = exerciciosAlunoUnicos.find((e) => e.nome.toLowerCase() === v.toLowerCase())
    const lib = biblioteca?.find((b) => b.nome.toLowerCase() === v.toLowerCase())
    const video = usado?.video_url || lib?.video_url
    const grp = usado?.grupo || lib?.grupo
    if (video) setVid(video)
    if (grp) setGrupo(grp)
    if (usado?.tipo_exercicio) setTipo(normalizeTipoExercicio(usado.tipo_exercicio))
    if (usado?.unidade_reps) setUnidadeReps(usado.unidade_reps)
    if (usado?.metrica_direcao) setMetricaDirecao(usado.metrica_direcao)
    const rec = usado?.observacoes ?? lib?.recomendacoes
    if (!obs && rec) setObs(rec)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome) return
    const validas = seriesPrescritas.filter((s) => s.reps || s.carga)
    await onSubmit({
      nome,
      grupo: grupo || undefined,
      bloco_id: blocoId || undefined,
      aquecimento,
      tipo_exercicio: tipo,
      unidade_carga: unidadeCarga || undefined,
      unidade_reps: unidadeReps || undefined,
      metrica_direcao: tipo === 'PERFORMANCE' ? metricaDirecao : undefined,
      series_prescritas: validas.length ? validas : undefined,
      intervalo_s: intervaloS,
      video_url: vid || undefined,
      observacoes: obs || undefined,
      rm_kg: rmKg ? parseFloat(rmKg) : undefined,
      links_uteis: linksUteis.length ? linksUteis : undefined,
      links_uteis_excluidos: linksUteisExcluidos.length ? linksUteisExcluidos : undefined,
      substitutos: substitutos.length ? substitutos : undefined,
      substitutos_excluidos: substitutosExcluidos.length ? substitutosExcluidos : undefined,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Identificação</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AutocompleteInput
            label="Exercício" autoFocus
            value={nome} onChange={onNome}
            suggestions={datalistNomes.map((item) => item.nome)}
          />
          <AutocompleteInput
            label="Grupo muscular"
            value={grupo} onChange={setGrupo}
            suggestions={grupos}
          />
        </div>
        <div className="flex items-end gap-3 mt-3">
          {(blocos?.length ?? 0) > 0 && (
            <div className="flex-1">
              <label className="text-xs text-text-muted mb-1 block">Bloco</label>
              <select
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text text-sm focus:outline-none focus:border-accent"
                value={blocoId}
                onChange={(e) => setBlocoId(e.target.value)}
              >
                <option value="">Sem bloco</option>
                {(blocos ?? []).filter((b) => !b.descanso).map((b) => (
                  <option key={b.id} value={b.id}>{b.nome}</option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none pb-2.5">
            <input type="checkbox" checked={aquecimento} onChange={(e) => setAquecimento(e.target.checked)} />
            Aquecimento <span className="opacity-70">(sem PR/volume/pontos)</span>
          </label>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Tipo de exercício</p>
        <div className="flex gap-2">
          {([
            { value: 'FORCA', label: 'Força' },
            { value: 'PERFORMANCE', label: 'Performance' },
          ] as { value: TipoExercicio; label: string }[]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTipo(opt.value)}
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
      {tipo === 'PERFORMANCE' && (
        <div className="rounded-lg border border-border bg-white/5 p-3 space-y-3">
          <p className="text-xs font-medium text-text-secondary">Métrica de performance</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Unidade</label>
              <AutocompleteInput
                maxLength={7}
                placeholder="ex.: km, min, voltas"
                value={unidadeReps} onChange={(v) => setUnidadeReps(v.slice(0, 7))}
                suggestions={['reps', 's', 'min', 'h', 'km', 'm', 'voltas', 'cal', 'passos']}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">O que é evoluir?</label>
              <div className="flex gap-2">
                {([
                  { value: 'MAIOR', label: '↑ Maior' },
                  { value: 'MENOR', label: '↓ Menor' },
                ] as { value: MetricaDirecao; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMetricaDirecao(opt.value)}
                    className={`flex-1 text-xs py-2 px-2 rounded-lg border transition-colors ${
                      metricaDirecao === opt.value
                        ? 'border-accent bg-accent/10 text-accent-hover font-medium'
                        : 'border-border text-text-muted hover:border-border-strong'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            O aluno registra um número por série nessa unidade (≤7 caracteres) — entra no gráfico e no PR.
            Use <b>↓ Menor</b> quando diminuir significa evoluir (tempo/pace, ex.: 5 km).
          </p>
          <div>
            <label className="text-xs text-text-muted mb-1 block">2ª medida (opcional)</label>
            <AutocompleteInput
              maxLength={7}
              placeholder="ex.: min, kcal, bpm"
              value={unidadeCarga} onChange={(v) => setUnidadeCarga(v.slice(0, 7))}
              suggestions={['min', 's', 'kcal', 'bpm', 'kg', 'm']}
            />
            <p className="text-xs text-text-muted mt-1">
              Preencha para o aluno registrar uma segunda medida por série (ex.: corrida — distância
              como métrica principal e <b>min</b> aqui). Só a métrica principal gera PR e gráfico;
              a 2ª aparece no histórico como contexto.
            </p>
          </div>
        </div>
      )}
      <div>
        <div className="flex items-center mb-2 gap-2">
          <p className="text-xs font-medium text-text-secondary flex-1">
            {tipo === 'PERFORMANCE' ? `Prescrição — séries × ${unidadeReps || 'métrica'}` : 'Prescrição — séries × reps · carga'}
          </p>
        </div>
        <SeriesPrescritasEditor
          value={seriesPrescritas}
          onChange={setSeriesPrescritas}
          tipoExercicio={tipo}
          unidadeReps={unidadeReps}
          unidadeCarga={unidadeCarga}
          rm_kg={rmKg ? parseFloat(rmKg) : undefined}
        />
      </div>
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Vídeo e observações</p>
        <div className="space-y-3">
          <Input label="Vídeo (URL)" value={vid} onChange={(e) => setVid(e.target.value)} />
          <Textarea
            label="Recomendações (visíveis ao aluno na sessão)" rows={2}
            value={obs} onChange={(e) => setObs(e.target.value)}
          />
          <IntervaloInput value={intervaloS} onChange={setIntervaloS} />
          {tipo === 'FORCA' && (
            <div>
              <Input
                label="1RM (kg)"
                type="number"
                min={1}
                step={0.5}
                value={rmKg}
                onChange={(e) => setRmKg(e.target.value)}
                placeholder="ex.: 100"
              />
              <p className="text-xs text-text-muted mt-1">
                Carga máxima estimada para 1 repetição. Usada para calcular a Intensidade Relativa Média (IRM) na evolução.
              </p>
            </div>
          )}
        </div>
      </div>
      <LinksUteisSelector exercicioNome={nome} biblioteca={biblioteca ?? []} value={linksUteisExcluidos} onChange={setLinksUteisExcluidos} />
      <LinksUteisIncluirSelector value={linksUteis} onChange={setLinksUteis} />
      <SubstitutosTreinoEditor
        exercicioNome={nome}
        biblioteca={biblioteca ?? []}
        seriesPrescritasOriginal={seriesPrescritas}
        substitutos={substitutos}
        onChangeSubstitutos={setSubstitutos}
        excluidos={substitutosExcluidos}
        onChangeExcluidos={setSubstitutosExcluidos}
        tipoExercicio={tipo}
      />
      <Button type="submit" className="w-full" disabled={submitting || !nome}>
        {submitting ? 'Salvando…' : submitLabel}
      </Button>
    </form>
  )
}

/** Histórico de execução — carrega sob demanda (só quando expandido), texto inline discreto. */
function ExecucaoStats({
  alunoId, exercicioId, unidadeCarga, unidadeReps, tipoExercicio,
}: {
  alunoId: string; exercicioId: string; unidadeCarga?: string; unidadeReps?: string; tipoExercicio?: string
}) {
  const { data, isLoading } = useEvolucao(alunoId, exercicioId)
  const { data: hist } = useHistoricoExercicio(alunoId, exercicioId)
  if (isLoading) return <div className="mt-1 text-xs text-text-muted">carregando histórico…</div>
  if (!data) return null
  const uni = unidadeCarga || 'kg'
  if (data.total_sessoes === 0) return <div className="mt-1 text-xs text-text-muted">ainda não executado</div>

  const isPerf = tipoExercicio === 'PERFORMANCE'
  const ultima = hist?.[0]
  const seriesUltima = ultima?.series_exec.filter((s) => !s.contexto) ?? []

  return (
    <div className="mt-1 text-xs space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="text-accent-hover font-medium">{data.total_sessoes} {data.total_sessoes === 1 ? 'execução' : 'execuções'}</span>
        {data.pr && <span className="text-success" title={`PR em ${fmtDateFull(data.pr.data)}`}>PR {data.pr.carga}{uni}</span>}
      </div>
      {seriesUltima.length > 0 && (
        <div>
          <span className="text-text-muted">
            Última vez ({new Date(ultima!.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})
          </span>
          {ultima?.pse != null && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-energy/10 px-2 py-0.5 text-[11px] font-medium text-energy align-middle">
              Esforço (PSE) {ultima.pse}/10
            </span>
          )}
          <div className="mt-0.5 flex flex-wrap gap-1">
            {seriesUltima.map((s, i) => {
              let label: string
              if (isPerf) {
                const extra = s.carga ? ` · ${s.carga} ${unidadeCarga ?? ''}`.trimEnd() : ''
                label = `${s.reps ?? '-'} ${unidadeReps ?? ''}`.trimEnd() + extra
              } else {
                const cargaLabel = s.carga ? ` · ${s.carga} ${unidadeCarga ?? 'kg'}` : ''
                label = `${s.reps ?? '-'} ${unidadeReps ?? 'reps'}${cargaLabel}`
              }
              return (
                <span key={i} className="text-text-secondary bg-white/5 rounded-md px-2 py-0.5">{label}</span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ExercicioRow({
  alunoId, treinoId, ex, index, biblioteca, exerciciosAluno, blocos, bloco, sortable,
}: {
  alunoId: string; treinoId: string; ex: Exercicio; index: number
  biblioteca?: { exlib_id: string; nome: string; grupo?: string; video_url?: string; substitutos?: ExercicioSubstituto[] }[]
  exerciciosAluno?: Exercicio[]
  blocos?: BlocoTreino[]
  /** Bloco a que a linha pertence — muda a exibição da prescrição ("12 por round"). */
  bloco?: BlocoTreino
  sortable: SortableRenderProps
}) {
  const [edit, setEdit] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const navigate = useNavigate()
  const upd = useUpdateExercicio(alunoId, treinoId)
  const del = useDeleteExercicio(alunoId, treinoId)
  const confirm = useConfirm()

  async function save(body: ExercicioCreate) {
    await upd.mutateAsync({ exercicioId: ex.exercicio_id, body: { ...body, ordem: ex.ordem } })
    setEdit(false)
  }

  async function remove() {
    const ok = await confirm({
      title: 'Excluir exercício',
      message: `Excluir "${ex.nome}"? O histórico de execução desse exercício será perdido.`,
      confirmLabel: 'Excluir', tone: 'danger',
    })
    if (ok) del.mutate(ex.exercicio_id)
  }

  const temPrescricao = !!(ex.series_prescritas?.length || ex.series || ex.reps_prescritas || ex.carga_prescrita)
  const pontuavel = !!bloco && bloco.formato !== 'LIVRE' && !bloco.aquecimento
  const sufixo = sufixoPrescricaoBloco(bloco)

  return (
    <div ref={sortable.setNodeRef} style={sortable.style} className="border-b border-border py-1.5">
      <div className="flex items-start gap-2">
        {/* Alça de arraste + número */}
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          {sortable.handle}
          <span className="text-[10px] font-mono text-text-muted w-4 text-center select-none">{index}</span>
        </div>

        {/* Nome + info inline */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap text-sm">
            <ExpandableText text={ex.nome} className="font-medium">{ex.nome}</ExpandableText>
            {ex.aquecimento && <Badge tone="neutral">aq.</Badge>}
          </div>
          <div className="text-xs text-text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {temPrescricao && (
              <span>
                {ex.series_prescritas?.length && (pontuavel || sufixo) ? (
                  <>
                    {fmtPrescricaoBloco(ex.series_prescritas, ex.unidade_reps)}
                    {sufixo && <span className="opacity-70"> {sufixo}</span>}
                  </>
                ) : ex.series_prescritas?.length ? (
                  <SeriesPrescritasCompact items={ex.series_prescritas} tipoExercicio={ex.tipo_exercicio} rm_kg={ex.rm_kg} />
                ) : (
                  <>{ex.series ? `${ex.series}x` : ''}{ex.reps_prescritas ?? ''}{ex.carga_prescrita ? ` · ${ex.carga_prescrita}` : ''}</>
                )}
              </span>
            )}
            {ex.rm_kg ? <span title="1RM estimado">RM {ex.rm_kg}{ex.unidade_carga || 'kg'}</span> : null}
            {ex.intervalo_s ? <span className="inline-flex items-center gap-0.5" title="Intervalo de descanso"><Clock size={11} />{ex.intervalo_s}s</span> : null}
            <a href={videoUrlComFallback(ex.nome, ex.video_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent-hover hover:underline"><Video size={12} />vídeo</a>
            {ex.observacoes ? <span className="inline-flex items-center gap-0.5 text-warning" title={ex.observacoes}><StickyNote size={11} />obs.</span> : null}
            <button type="button" onClick={() => setStatsOpen((v) => !v)} className="inline-flex items-center gap-0.5 hover:text-text transition-colors" title="Ver histórico de execução"><TrendingUp size={11} />histórico</button>
          </div>
          {statsOpen && <ExecucaoStats alunoId={alunoId} exercicioId={ex.exercicio_id} unidadeCarga={ex.unidade_carga} unidadeReps={ex.unidade_reps} tipoExercicio={ex.tipo_exercicio} />}
        </div>

        {/* Ações */}
        <OverflowMenu
          ariaLabel="Ações do exercício"
          items={[
            { icon: <MessageCircle size={14} />, label: 'Feed do exercício', onClick: () => navigate(`/alunos/${alunoId}/evolucao?highlight=${ex.exercicio_id}`) },
            { icon: <Camera size={14} />, label: 'Fotos e vídeos', onClick: () => setMediaOpen(true) },
            { icon: <Pencil size={14} />, label: 'Editar', onClick: () => setEdit(true) },
            { icon: <Trash2 size={14} />, label: 'Excluir', tone: 'danger', onClick: remove },
          ]}
        />
      </div>

      <Modal open={edit} onClose={() => setEdit(false)} title="Editar exercício" size="lg">
        <ExercicioForm initial={ex} biblioteca={biblioteca} exerciciosAluno={exerciciosAluno} blocos={blocos} submitLabel="Salvar" submitting={upd.isPending} onSubmit={save} />
      </Modal>

      <ExercicioMediaModal
        alunoId={alunoId}
        exercicio={ex}
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
      />
    </div>
  )
}

function HistoricoPersonal({ alunoId }: { alunoId: string }) {
  // Mesmo toggle Mês/Lista do app do aluno. O calendário vai SEM fotos de check-in e sem o botão
  // de compartilhar story (privacidade do aluno); a lista é read-only (sem envio de foto).
  const [view, setView] = useState<'mes' | 'lista'>('mes')
  const qc = useQueryClient()
  return (
    <div className="space-y-4 pb-4">
      <FeriasPanel
        queryKey={['ferias', alunoId]}
        list={() => feriasApi.list(alunoId)}
        create={(body) => feriasApi.create(alunoId, body)}
        remove={(tsId) => feriasApi.remove(alunoId, tsId)}
        onChanged={() => qc.invalidateQueries({ queryKey: [`personal-historico-mes-${alunoId}`] })}
      />
      <div className="flex gap-1 p-1 rounded-xl bg-surface-elevated border border-border">
        {([['mes', 'Mês', <CalendarDays size={14} />], ['lista', 'Lista', <List size={14} />]] as const).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-colors ${
              view === key ? 'bg-surface text-text shadow-[var(--shadow-card)]' : 'text-text-muted hover:text-text'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>
      {view === 'mes' ? (
        <CalendarioMes
          fetcher={(ano, mes) => treinosApi.historicoMesAluno(alunoId, ano, mes)}
          queryKeyPrefix={`personal-historico-mes-${alunoId}`}
          mostrarFotos={false}
          permitirCompartilhar={false}
          renderDetalhe={(sessaoId) => <SessaoDetalheCard alunoId={alunoId} sessaoId={sessaoId} />}
        />
      ) : (
        <HistoricoLista
          useTimeline={() => usePersonalTimeline(alunoId)}
          renderDetalhe={(id) => <SessaoDetalheCard alunoId={alunoId} sessaoId={id} />}
        />
      )}
    </div>
  )
}

function ExercicioMediaModal({
  alunoId, exercicio, open, onClose,
}: { alunoId: string; exercicio: Exercicio; open: boolean; onClose: () => void }) {
  const { data: midias, isLoading, refetch } = useMidiaExercicio(alunoId, exercicio.exercicio_id, open)
  const { show } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const { upload_url, s3_key } = await treinosApi.uploadUrlMidia(alunoId, file.name, file.type)
      await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      const tipo = file.type.startsWith('video') ? 'video_correcao' : 'foto_correcao'
      await treinosApi.enviarCorrecao(alunoId, {
        s3_key, tipo, exercicio_id: exercicio.exercicio_id, exercicio_nome: exercicio.nome,
      })
      show('Mídia de correção enviada.', 'success')
      refetch()
    } catch {
      show('Não foi possível enviar a mídia.', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Fotos e vídeos — ${exercicio.nome}`} size="lg">
      <div className="space-y-4">
        <div>
          <label className={`inline-flex items-center gap-1.5 text-sm cursor-pointer px-3 py-2 rounded-lg border border-border hover:bg-surface-elevated transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Camera size={14} />
            {uploading ? 'Enviando…' : 'Anexar (foto ou vídeo)'}
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" disabled={uploading} onChange={handleUpload} />
          </label>
          <p className="text-xs text-text-muted mt-1">Visível ao aluno na aba Evolução.</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : !midias?.length ? (
          <p className="text-sm text-text-muted">Nenhuma mídia anexada ainda.</p>
        ) : (
          <MediaTimeline items={midias.map((m) => ({ ...m, ator: m.ator ?? 'ALUNO' }))} />
        )}
      </div>
    </Modal>
  )
}

const ROTINA_MODO_OPTIONS: { value: AplicarRotinaModo; label: string; hint: string }[] = [
  { value: 'adicionar', label: 'Adicionar ao lado', hint: 'Mantém os treinos atuais' },
  { value: 'substituir', label: 'Substituir tudo', hint: 'Apaga os treinos atuais' },
]

const LOJA_URL = 'https://loja.coachpilot.com.br'

function AplicarRotinaNoAluno({ alunoId, temTreinos, onDone }: { alunoId: string; temTreinos: boolean; onDone: () => void }) {
  const { data: rotinas, isLoading } = useRotinas()
  const aplicar = useAplicarRotina()
  const confirm = useConfirm()
  const { show } = useToast()
  const [selecionada, setSelecionada] = useState<Rotina | null>(null)
  const [modo, setModo] = useState<AplicarRotinaModo>(temTreinos ? 'adicionar' : 'adicionar')

  async function submit() {
    if (!selecionada) return
    if (modo === 'substituir' && temTreinos) {
      const ok = await confirm({
        title: 'Substituir treinos',
        message: 'Isso apaga TODOS os treinos atuais do aluno e cria os da rotina no lugar. Continuar?',
        confirmLabel: 'Substituir', tone: 'danger',
      })
      if (!ok) return
    }
    await aplicar.mutateAsync({ id: selecionada.rotina_id, alunoIds: [alunoId], modo })
    show(`Rotina "${selecionada.nome}" aplicada.`, 'success')
    onDone()
  }

  if (isLoading) return <div className="flex justify-center py-4"><Spinner /></div>
  if (!rotinas?.length) {
    return (
      <p className="text-sm text-text-muted">
        Nenhuma rotina criada ainda. Salve a rotina de um aluno ou monte uma na aba Rotinas — ou{' '}
        <a href={LOJA_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          compre ou resgate pacotes prontos (inclusive gratuitos) na Loja do CoachPilot
        </a>.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Escolha a rotina</p>
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {rotinas.map((r) => (
            <button
              key={r.rotina_id}
              type="button"
              onClick={() => setSelecionada(r)}
              className={`w-full flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded-lg border transition-colors ${
                selecionada?.rotina_id === r.rotina_id ? 'border-accent bg-accent/10' : 'border-border hover:border-border-strong'
              }`}
            >
              <span className="text-sm truncate">{r.nome}</span>
              <Badge tone="neutral"><Dumbbell size={10} /> {r.treinos.length} treino{r.treinos.length === 1 ? '' : 's'}</Badge>
            </button>
          ))}
        </div>
      </div>

      {temTreinos && (
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">O aluno já tem treinos</p>
          <div className="flex gap-2">
            {ROTINA_MODO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setModo(opt.value)}
                className={`flex-1 text-left text-xs py-2 px-2.5 rounded-lg border transition-colors ${
                  modo === opt.value ? 'border-accent bg-accent/10 text-accent-hover' : 'border-border text-text-muted hover:border-border-strong'
                }`}
              >
                <span className="font-medium block">{opt.label}</span>
                <span className="text-[11px] opacity-80">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Button className="w-full" onClick={submit} disabled={!selecionada || aplicar.isPending}>
        {aplicar.isPending ? 'Aplicando…' : 'Aplicar rotina'}
      </Button>
    </div>
  )
}
