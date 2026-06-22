import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, Pencil, TrendingUp, Scale, Send, Copy, Dumbbell, LayoutTemplate, StickyNote, Camera, Clock, RefreshCw, AlertCircle, History, Power, PowerOff, Bot, ClipboardList } from 'lucide-react'
import { useAluno, useUpdateAluno, useDeleteAluno } from '../hooks/useAlunos'
import { useToggleAgenteHabilitado } from '../hooks/usePersonalChat'
import { usePlanoStatus } from '../hooks/usePlano'
import { alunosApi } from '../api/alunos'
import { anamneseApi } from '../api/anamnese'
import {
  useTreinos, useCreateTreino, useUpdateTreino, useDeleteTreino,
  useExercicios, useCreateExercicio, useUpdateExercicio, useDeleteExercicio, useMidiaExercicio,
} from '../hooks/useTreinos'
import { Button, Card, Input, Textarea, Spinner, Tabs, Badge, EmptyState, Modal, ErrorText, useToast, useConfirm, AvatarUpload, Avatar } from '../components/ui'
import { PhoneInput } from '../components/PhoneInput'
import { MediaTimeline } from '../components/media/MediaTimeline'
import { useBiblioteca } from '../hooks/useDominio'
import { useCreateTemplateFromTreino } from '../hooks/useTemplates'
import { useNotas, useCreateNota } from '../hooks/useNotas'
import { treinosApi, type SessaoHistoricoPersonal } from '../api/treinos'
import { SeriesPrescritasEditor, SeriesPrescritasCompact, initSeriesPrescritas } from '../components/exercicios/SeriesPrescritasEditor'
import { LinksUteisSelector } from '../components/exercicios/LinksUteisSelector'
import { LinksUteisIncluirSelector } from '../components/exercicios/LinksUteisIncluirSelector'
import { SessaoDetalheCard } from '../components/historico/SessaoDetalheCard'
import type { Treino, Exercicio, ExercicioCreate, SeriePrescrita, AlunoExistenteConflict, Aluno } from '../types'
import { FrequenciaTab } from '../components/aluno/FrequenciaTab'
import { MetasTab } from '../components/aluno/MetasTab'
import { FinanceiroTab } from '../components/financeiro/FinanceiroTab'

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

  const { data: treinos, isLoading } = useTreinos(alunoId)
  const createTreino = useCreateTreino(alunoId)
  const updateAluno = useUpdateAluno(alunoId)
  const deleteAluno = useDeleteAluno()
  const toggleAgente = useToggleAgenteHabilitado(alunoId)
  const { data: plano } = usePlanoStatus()
  const addonIaAtivo = plano?.addon_ia_ativo ?? false

  function handleToggleAgente(habilitado: boolean) {
    toggleAgente.mutate(habilitado, {
      onError: (err: any) => {
        if (err?.response?.data?.detail?.code === 'ADDON_REQUIRED') {
          show('Assistente IA é um add-on opcional — em breve disponível para contratação.', 'error')
        } else {
          show('Erro ao atualizar o agente.', 'error')
        }
      },
    })
  }
  const confirm = useConfirm()
  const [tab, setTab] = useState<'perfil' | 'treinos' | 'historico' | 'frequencia' | 'metas' | 'financeiro'>('treinos')
  const [showAddTreino, setShowAddTreino] = useState(false)
  const [nome, setNome] = useState('')
  const [foco, setFoco] = useState('')
  const [dtIni, setDtIni] = useState('')
  const [dtFim, setDtFim] = useState('')
  const [editing, setEditing] = useState(false)
  const [eNome, setENome] = useState('')
  const [eTel, setETel] = useState('')
  const [eEmail, setEEmail] = useState('')
  const [eEndereco, setEEndereco] = useState('')
  const [eNascimento, setENascimento] = useState('')
  const [eObj, setEObj] = useState('')
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
  const enviarLink = useMutation({
    mutationFn: () => alunosApi.enviarLink(alunoId),
    onSuccess: () => show('Link enviado pelo WhatsApp.', 'success'),
  })
  function copyLink() {
    if (!linkData?.link) return
    navigator.clipboard?.writeText(linkData.link)
    show('Link copiado!', 'success')
  }

  function startEdit() {
    setENome(aluno?.nome ?? ''); setETel(aluno?.telefone ?? '')
    setEEmail(aluno?.email ?? ''); setEEndereco(aluno?.endereco ?? ''); setENascimento(aluno?.data_nascimento ?? '')
    setEObj(aluno?.objetivo ?? ''); setEDescricao(aluno?.descricao ?? '')
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
        data_nascimento: eNascimento || undefined, objetivo: eObj || undefined,
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
      ordem: (treinos?.length ?? 0) + 1,
    })
    setNome(''); setFoco(''); setDtIni(''); setDtFim('')
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
          {aluno && (
            <Button
              variant={aluno.agente_habilitado ? 'outline' : 'primary'}
              size="sm"
              onClick={() => handleToggleAgente(!aluno.agente_habilitado)}
              disabled={toggleAgente.isPending || (!aluno.agente_habilitado && !addonIaAtivo)}
              title={!aluno.agente_habilitado && !addonIaAtivo ? 'Assistente IA é um add-on em breve' : undefined}
              className="gap-1.5 px-2.5 py-1.5 h-auto text-[9px] leading-tight items-center"
            >
              <Bot size={13} className="shrink-0" />
              <span className="text-left">{aluno.agente_habilitado ? <>Desabilitar<br/>agente</> : <>Habilitar<br/>agente</>}</span>
            </Button>
          )}
        </div>
      </div>

      {linkData && (
        <Card variant="elevated" className="mb-4">
          <p className="text-xs text-text-secondary mb-2">Link do app do aluno</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={linkData.link}
              onFocus={(e) => e.target.select()}
              className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-surface border border-border text-text-secondary"
            />
            <Button variant="ghost" size="sm" iconOnly aria-label="Copiar link" onClick={copyLink}><Copy size={15} /></Button>
            <Button variant="ghost" size="sm" iconOnly aria-label="Enviar pelo WhatsApp" onClick={() => enviarLink.mutate()} disabled={enviarLink.isPending}><Send size={15} /></Button>
          </div>
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
              <Input label="Objetivo" value={eObj} onChange={(e) => setEObj(e.target.value)} />
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
                <p className="text-xs text-text-muted">Objetivo</p>
                <p className="text-sm">{aluno?.objetivo || '—'}</p>
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
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowAddTreino(true)}>
              <span className="flex items-center gap-1"><Plus size={16} /> Adicionar treino</span>
            </Button>
          </div>

          <Modal open={showAddTreino} onClose={() => setShowAddTreino(false)} title="Novo treino" size="lg">
            <form onSubmit={addTreino} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Treino" placeholder="ex: Treino A" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
                <Input label="Foco" placeholder="ex: Inferiores" value={foco} onChange={(e) => setFoco(e.target.value)} />
                <Input label="Início" type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} />
                <Input label="Fim" type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={createTreino.isPending}>
                {createTreino.isPending ? 'Adicionando…' : 'Adicionar treino'}
              </Button>
            </form>
          </Modal>

          {isLoading ? (
            <Spinner />
          ) : !treinos?.length ? (
            <EmptyState icon={<Dumbbell />} title="Nenhum treino" description="Adicione o primeiro treino no formulário acima." />
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
const fmtDuracao = (secs?: number) => {
  if (!secs) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  return `${m}min`
}

function TreinosLista({ alunoId, treinos }: { alunoId: string; treinos: Treino[] }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const vigentes = treinos.filter((t) => t.ativo !== false && (!t.data_fim || t.data_fim >= hoje))
  const expirados = treinos.filter((t) => t.ativo === false || (t.data_fim && t.data_fim < hoje))
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

  async function reordenar(fromIdx: number, toIdx: number) {
    setReordering(true)
    const newList = [...vigentes]
    ;[newList[fromIdx], newList[toIdx]] = [newList[toIdx], newList[fromIdx]]
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
                custom: t.custom, ordem: idx,
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
        ativo: true, data_inicio: t.data_inicio, data_fim: novaDataFim || undefined, custom: t.custom,
      },
    })
    show('Vigência renovada.', 'success')
    setRenovandoId(null)
  }

  return (
    <div className="space-y-3">
      {vigentes.map((t, idx) => (
        <div key={t.treino_id} className="flex items-start gap-1">
          <div className="flex flex-col items-center gap-0.5 pt-1.5 shrink-0 w-5">
            <button
              disabled={idx === 0 || reordering}
              onClick={() => reordenar(idx, idx - 1)}
              className="p-0.5 text-text-muted hover:text-text disabled:opacity-25 transition-opacity"
              aria-label="Mover para cima"
            >
              <ChevronUp size={13} />
            </button>
            <span className="text-[10px] font-mono text-text-muted leading-none select-none">{idx + 1}</span>
            <button
              disabled={idx === vigentes.length - 1 || reordering}
              onClick={() => reordenar(idx, idx + 1)}
              className="p-0.5 text-text-muted hover:text-text disabled:opacity-25 transition-opacity"
              aria-label="Mover para baixo"
            >
              <ChevronDown size={13} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <TreinoCard alunoId={alunoId} treino={t} />
          </div>
        </div>
      ))}

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

function TreinoCard({ alunoId, treino, expired, onRenovar }: { alunoId: string; treino: Treino; expired?: boolean; onRenovar?: () => void }) {
  const [open, setOpen] = useState(false)
  const [editT, setEditT] = useState(false)
  const [addingEx, setAddingEx] = useState(false)
  const delTreino = useDeleteTreino(alunoId)
  const updTreino = useUpdateTreino(alunoId)
  const saveAsTemplate = useCreateTemplateFromTreino()
  const { show } = useToast()
  const confirm = useConfirm()
  const { data: exs } = useExercicios(alunoId, open ? treino.treino_id : '')
  const { data: biblioteca } = useBiblioteca()
  const createEx = useCreateExercicio(alunoId, treino.treino_id)
  const [tNome, setTNome] = useState(treino.nome)
  const [tFoco, setTFoco] = useState(treino.foco ?? '')
  const [tIni, setTIni] = useState(treino.data_inicio ?? '')
  const [tFim, setTFim] = useState(treino.data_fim ?? '')

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
      body: { nome: tNome, foco: tFoco || undefined, data_inicio: tIni || undefined, data_fim: tFim || undefined },
    })
    setEditT(false)
  }

  return (
    <Card variant="elevated" className={expired ? 'opacity-70' : ''}>
      <div className="flex items-center justify-between gap-2">
        <button className="flex-1 min-w-0 overflow-hidden flex items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
          <span className="min-w-0 overflow-hidden">
            <span className="font-medium truncate block">{treino.nome}</span>
            {(treino.foco || treino.data_inicio || treino.data_fim) && (
              <span className="text-xs text-text-muted truncate block">
                {treino.foco && treino.foco}
                {treino.foco && (treino.data_inicio || treino.data_fim) && ' · '}
                {(treino.data_inicio || treino.data_fim) && `${fmtDate(treino.data_inicio)}${treino.data_fim ? ` – ${fmtDate(treino.data_fim)}` : ''}`}
              </span>
            )}
          </span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost" size="sm" iconOnly aria-label="Salvar como template"
            onClick={salvarComoTemplate}
            disabled={saveAsTemplate.isPending}
          >
            <LayoutTemplate size={15} />
          </Button>
          {expired
            ? <Button variant="ghost" size="sm" iconOnly aria-label="Renovar vigência" onClick={onRenovar}><RefreshCw size={15} /></Button>
            : <Button variant="ghost" size="sm" iconOnly aria-label="Editar treino" onClick={() => setEditT(true)}><Pencil size={15} /></Button>
          }
          <Button variant="ghost" size="sm" iconOnly aria-label="Excluir treino" onClick={removerTreino} className="hover:text-danger"><Trash2 size={16} /></Button>
        </div>
      </div>

      <Modal open={editT} onClose={() => setEditT(false)} title="Editar treino" size="lg">
        <form onSubmit={saveTreino} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Treino" value={tNome} onChange={(e) => setTNome(e.target.value)} autoFocus />
            <Input label="Foco" value={tFoco} onChange={(e) => setTFoco(e.target.value)} />
            <Input label="Início" type="date" value={tIni} onChange={(e) => setTIni(e.target.value)} />
            <Input label="Fim" type="date" value={tFim} onChange={(e) => setTFim(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={updTreino.isPending}>
            {updTreino.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </Modal>

      {open && (
        <div className="mt-3 pl-2 sm:pl-6 space-y-1">
          {(exs ?? []).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((ex) => (
            <ExercicioRow key={ex.exercicio_id} alunoId={alunoId} treinoId={treino.treino_id} ex={ex} biblioteca={biblioteca} />
          ))}
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setAddingEx(true)}>
            <span className="flex items-center gap-1"><Plus size={14} /> Exercício</span>
          </Button>
        </div>
      )}

      <Modal open={addingEx} onClose={() => setAddingEx(false)} title="Novo exercício" size="lg">
        <ExercicioForm biblioteca={biblioteca} submitLabel="Adicionar exercício" submitting={createEx.isPending} onSubmit={addEx} />
      </Modal>
    </Card>
  )
}

function ExercicioForm({
  initial, biblioteca, onSubmit, submitting, submitLabel,
}: {
  initial?: Partial<Exercicio>
  biblioteca?: { exlib_id: string; nome: string; video_url?: string; links_uteis?: string[] }[]
  onSubmit: (body: ExercicioCreate) => Promise<void>
  submitting?: boolean
  submitLabel: string
}) {
  const listId = useId()
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [seriesPrescritas, setSeriesPrescritas] = useState<SeriePrescrita[]>(() =>
    initSeriesPrescritas(initial?.series_prescritas, initial?.series, initial?.reps_prescritas, initial?.carga_prescrita)
  )
  const [vid, setVid] = useState(initial?.video_url ?? '')
  const [obs, setObs] = useState(initial?.observacoes ?? '')
  const [linksUteis, setLinksUteis] = useState<string[]>(initial?.links_uteis ?? [])
  const [linksUteisExcluidos, setLinksUteisExcluidos] = useState<string[]>(initial?.links_uteis_excluidos ?? [])

  function onNome(v: string) {
    setNome(v)
    const lib = biblioteca?.find((b) => b.nome.toLowerCase() === v.toLowerCase())
    if (lib?.video_url) setVid(lib.video_url)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome) return
    const validas = seriesPrescritas.filter((s) => s.reps || s.carga)
    await onSubmit({
      nome,
      series_prescritas: validas.length ? validas : undefined,
      video_url: vid || undefined,
      observacoes: obs || undefined,
      links_uteis: linksUteis.length ? linksUteis : undefined,
      links_uteis_excluidos: linksUteisExcluidos.length ? linksUteisExcluidos : undefined,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Identificação</p>
        <Input
          label="Exercício" list={listId} autoFocus
          value={nome} onChange={(e) => onNome(e.target.value)}
        />
        <datalist id={listId}>{biblioteca?.map((b) => <option key={b.exlib_id} value={b.nome} />)}</datalist>
      </div>
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Prescrição — séries × reps · carga</p>
        <SeriesPrescritasEditor value={seriesPrescritas} onChange={setSeriesPrescritas} />
      </div>
      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Vídeo e observações</p>
        <div className="space-y-3">
          <Input label="Vídeo (URL)" value={vid} onChange={(e) => setVid(e.target.value)} />
          <Textarea
            label="Observações (visíveis ao aluno na sessão)" rows={2}
            value={obs} onChange={(e) => setObs(e.target.value)}
          />
        </div>
      </div>
      <LinksUteisSelector exercicioNome={nome} biblioteca={biblioteca ?? []} value={linksUteisExcluidos} onChange={setLinksUteisExcluidos} />
      <LinksUteisIncluirSelector value={linksUteis} onChange={setLinksUteis} />
      <Button type="submit" className="w-full" disabled={submitting || !nome}>
        {submitting ? 'Salvando…' : submitLabel}
      </Button>
    </form>
  )
}

function ExercicioRow({
  alunoId, treinoId, ex, biblioteca,
}: { alunoId: string; treinoId: string; ex: Exercicio; biblioteca?: { exlib_id: string; nome: string; video_url?: string }[] }) {
  const [edit, setEdit] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
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

  return (
    <div className="border-b border-border pb-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate">
          {ex.nome}
          <span className="ml-2">
            {ex.series_prescritas?.length
              ? <SeriesPrescritasCompact items={ex.series_prescritas} />
              : <span className="text-xs text-text-muted">{ex.series ? `${ex.series}x` : ''}{ex.reps_prescritas ?? ''}{ex.carga_prescrita ? ` · ${ex.carga_prescrita}` : ''}</span>
            }
          </span>
          {ex.video_url && <a href={ex.video_url} target="_blank" rel="noreferrer" className="text-accent-hover ml-2 text-xs hover:underline">vídeo</a>}
          {ex.observacoes && (
            <span title={ex.observacoes} className="inline-block ml-2 align-text-bottom">
              <StickyNote size={12} className="text-warning" />
            </span>
          )}
        </span>
        <span className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" iconOnly aria-label="Fotos e vídeos" onClick={() => setMediaOpen(true)}><Camera size={13} /></Button>
          <Button variant="ghost" size="sm" iconOnly aria-label="Editar exercício" onClick={() => setEdit(true)}><Pencil size={13} /></Button>
          <Button variant="ghost" size="sm" iconOnly aria-label="Excluir exercício" onClick={remove} className="hover:text-danger"><Trash2 size={14} /></Button>
        </span>
      </div>

      <Modal open={edit} onClose={() => setEdit(false)} title="Editar exercício" size="lg">
        <ExercicioForm initial={ex} biblioteca={biblioteca} submitLabel="Salvar" submitting={upd.isPending} onSubmit={save} />
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

function groupSessoesByPeriodo(sessions: SessaoHistoricoPersonal[]) {
  const groups: { label: string; items: SessaoHistoricoPersonal[] }[] = []
  for (const s of sessions) {
    const d = new Date(s.data_hora_inicio)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    let label: string
    if (diffDays <= 6) label = 'Esta semana'
    else if (diffDays <= 13) label = 'Semana passada'
    else {
      const mes = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      label = mes.charAt(0).toUpperCase() + mes.slice(1)
    }
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(s)
    else groups.push({ label, items: [s] })
  }
  return groups
}

function HistoricoPersonal({ alunoId }: { alunoId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const query = useInfiniteQuery({
    queryKey: ['sessoes-personal', alunoId],
    queryFn: ({ pageParam }) => treinosApi.listSessoes(alunoId, { cursor: pageParam as string | undefined, limit: 10 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!alunoId,
  })
  const sessions = query.data?.pages.flatMap((p) => p.items) ?? []

  if (query.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (!sessions.length)
    return <EmptyState icon={<History />} title="Nenhum treino finalizado ainda" description="O histórico aparece aqui quando o aluno finalizar uma sessão." />

  const groups = groupSessoesByPeriodo(sessions)

  return (
    <div className="space-y-4 pb-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{g.label}</p>
          <div className="space-y-2">
            {g.items.map((s) => {
              const expanded = expandedId === s.sessao_id
              const totalSeries = (s.exercicios_exec ?? []).reduce((acc, e) => acc + (e.series_exec?.length ?? 0), 0)
              return (
                <Card key={s.sessao_id} variant="elevated">
                  <button
                    className="w-full flex items-start justify-between text-left gap-2"
                    onClick={() => setExpandedId(expanded ? null : s.sessao_id)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.treino_nome}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {new Date(s.data_hora_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {s.duracao_segundos ? <> · <Clock size={10} className="inline mb-0.5" /> {fmtDuracao(s.duracao_segundos)}</> : null}
                        {s.total_ex ? ` · ${s.total_ex} exercício${s.total_ex !== 1 ? 's' : ''}` : null}
                        {totalSeries ? ` · ${totalSeries} séries` : null}
                      </p>
                    </div>
                    {expanded
                      ? <ChevronDown size={16} className="shrink-0 text-text-muted mt-0.5" />
                      : <ChevronRight size={16} className="shrink-0 text-text-muted mt-0.5" />}
                  </button>
                  {expanded && (
                    <SessaoDetalheCard alunoId={alunoId} sessaoId={s.sessao_id} />
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      ))}
      {query.hasNextPage && (
        <Button variant="outline" className="w-full" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
          {query.isFetchingNextPage ? <Spinner /> : 'Carregar mais'}
        </Button>
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
            {uploading ? 'Enviando…' : 'Anexar correção (foto ou vídeo)'}
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" disabled={uploading} onChange={handleUpload} />
          </label>
          <p className="text-xs text-text-muted mt-1">Visible ao aluno na aba Evolução.</p>
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
