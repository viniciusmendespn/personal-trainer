import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, Pencil, TrendingUp, Scale, Check, X, Send, Dumbbell, LayoutTemplate, StickyNote, Link2 } from 'lucide-react'
import { useAluno, useUpdateAluno, useDeleteAluno } from '../hooks/useAlunos'
import { alunosApi } from '../api/alunos'
import {
  useTreinos, useCreateTreino, useUpdateTreino, useDeleteTreino,
  useExercicios, useCreateExercicio, useUpdateExercicio, useDeleteExercicio,
} from '../hooks/useTreinos'
import { Button, Card, Input, Select, Textarea, Spinner, Tabs, Badge, EmptyState, useToast } from '../components/ui'
import { useBiblioteca } from '../hooks/useDominio'
import { useCreateTemplateFromTreino } from '../hooks/useTemplates'
import type { Treino, Exercicio } from '../types'

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function AlunoDetailPage() {
  const { alunoId = '' } = useParams()
  const navigate = useNavigate()
  const { data: aluno } = useAluno(alunoId)
  const { data: treinos, isLoading } = useTreinos(alunoId)
  const createTreino = useCreateTreino(alunoId)
  const updateAluno = useUpdateAluno(alunoId)
  const deleteAluno = useDeleteAluno()
  const [tab, setTab] = useState<'perfil' | 'treinos'>('treinos')
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
  const [linkRes, setLinkRes] = useState<{ link: string; enviado: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const enviarLink = useMutation({
    mutationFn: () => alunosApi.enviarLink(alunoId),
    onSuccess: (d) => { setLinkRes(d); setCopied(false) },
  })
  const gerarLink = useMutation({
    mutationFn: () => alunosApi.gerarLink(alunoId),
    onSuccess: (d) => { setLinkRes({ link: d.link, enviado: false }); setCopied(false) },
  })
  function copyLink() {
    if (!linkRes) return
    navigator.clipboard?.writeText(linkRes.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function startEdit() {
    setENome(aluno?.nome ?? ''); setETel(aluno?.telefone ?? '')
    setEEmail(aluno?.email ?? ''); setEEndereco(aluno?.endereco ?? ''); setENascimento(aluno?.data_nascimento ?? '')
    setEObj(aluno?.objetivo ?? '')
    setEditing(true)
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    await updateAluno.mutateAsync({
      nome: eNome, telefone: eTel,
      email: eEmail || undefined, endereco: eEndereco || undefined,
      data_nascimento: eNascimento || undefined, objetivo: eObj || undefined,
    })
    setEditing(false)
  }
  async function remove() {
    if (!confirm('Excluir este aluno?')) return
    await deleteAluno.mutateAsync(alunoId)
    navigate('/alunos')
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
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/alunos" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text mb-4">
        <ArrowLeft size={16} /> Alunos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-xl font-semibold">{aluno?.nome ?? '…'}</h2>
          {aluno && <Badge tone={aluno.status === 'ATIVO' ? 'success' : 'neutral'} className="mt-1">{aluno.status}</Badge>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={`/alunos/${alunoId}/evolucao`} className="inline-flex items-center gap-1 text-sm text-accent-hover hover:underline">
            <TrendingUp size={16} /> Evolução
          </Link>
          <Link to={`/alunos/${alunoId}/avaliacoes`} className="inline-flex items-center gap-1 text-sm text-accent-hover hover:underline">
            <Scale size={16} /> Avaliação
          </Link>
          <button onClick={() => gerarLink.mutate()} disabled={gerarLink.isPending}
            className="inline-flex items-center gap-1 text-sm text-accent-hover hover:underline disabled:opacity-50" title="Copiar link do app">
            <Link2 size={15} /> {gerarLink.isPending ? 'Gerando…' : 'Copiar link'}
          </button>
          <button onClick={() => enviarLink.mutate()} disabled={enviarLink.isPending}
            className="inline-flex items-center gap-1 text-sm text-accent-hover hover:underline disabled:opacity-50" title="Enviar link do app pelo WhatsApp">
            <Send size={15} /> {enviarLink.isPending ? 'Enviando…' : 'Enviar app'}
          </button>
        </div>
      </div>

      {linkRes && (
        <Card variant="elevated" className="mb-4">
          <p className="text-xs text-text-secondary mb-2">
            {linkRes.enviado ? 'Link enviado no WhatsApp do aluno ✓ — você também pode copiar:' : 'WhatsApp não conectado — copie o link e envie ao aluno:'}
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={linkRes.link}
              onFocus={(e) => e.target.select()}
              className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-surface border border-border text-text-secondary"
            />
            <Button variant="ghost" size="sm" onClick={copyLink}>{copied ? 'Copiado!' : 'Copiar'}</Button>
          </div>
        </Card>
      )}

      <Tabs
        className="mb-4"
        tabs={[{ key: 'treinos', label: 'Treinos' }, { key: 'perfil', label: 'Perfil' }]}
        active={tab}
        onChange={(k) => setTab(k as 'perfil' | 'treinos')}
      />

      {tab === 'perfil' && (
        <Card variant="elevated" className="max-w-md">
          {editing ? (
            <form onSubmit={saveEdit} className="space-y-3">
              <Input label="Nome" value={eNome} onChange={(e) => setENome(e.target.value)} />
              <Input label="Telefone" value={eTel} onChange={(e) => setETel(e.target.value)} />
              <Input label="E-mail" type="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} />
              <Input label="Data de nascimento" type="date" value={eNascimento} onChange={(e) => setENascimento(e.target.value)} />
              <Input label="Endereço" value={eEndereco} onChange={(e) => setEEndereco(e.target.value)} />
              <Input label="Objetivo" value={eObj} onChange={(e) => setEObj(e.target.value)} />
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
      )}

      {tab === 'treinos' && (
        <>
          <Card variant="elevated" className="mb-4">
            <form onSubmit={addTreino} className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1.2fr_1.2fr_auto] gap-3 items-end">
              <Input label="Treino" placeholder="ex: Treino A" value={nome} onChange={(e) => setNome(e.target.value)} />
              <Input label="Foco" placeholder="ex: Inferiores" value={foco} onChange={(e) => setFoco(e.target.value)} />
              <Input label="Início" type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} />
              <Input label="Fim" type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} />
              <Button type="submit" disabled={createTreino.isPending} iconOnly aria-label="Adicionar treino">
                <Plus size={16} />
              </Button>
            </form>
          </Card>

          {isLoading ? (
            <Spinner />
          ) : !treinos?.length ? (
            <EmptyState icon={<Dumbbell />} title="Nenhum treino" description="Adicione o primeiro treino no formulário acima." />
          ) : (
            <div className="space-y-3">
              {treinos.map((t) => (
                <TreinoCard key={t.treino_id} alunoId={alunoId} treino={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const fmtDate = (d?: string) => (d ? d.split('-').reverse().slice(0, 2).join('/') : '')
const fmtDateFull = (d?: string) => (d ? d.split('-').reverse().join('/') : '')

function TreinoCard({ alunoId, treino }: { alunoId: string; treino: Treino }) {
  const [open, setOpen] = useState(false)
  const [editT, setEditT] = useState(false)
  const delTreino = useDeleteTreino(alunoId)
  const updTreino = useUpdateTreino(alunoId)
  const saveAsTemplate = useCreateTemplateFromTreino()
  const { show } = useToast()
  const { data: exs } = useExercicios(alunoId, open ? treino.treino_id : '')
  const { data: biblioteca } = useBiblioteca()
  const createEx = useCreateExercicio(alunoId, treino.treino_id)
  const [nome, setNome] = useState('')
  const [series, setSeries] = useState('')
  const [reps, setReps] = useState('')
  const [carga, setCarga] = useState('')
  const [vid, setVid] = useState('')
  const [dia, setDia] = useState('')
  const [obs, setObs] = useState('')
  const [tNome, setTNome] = useState(treino.nome)
  const [tFoco, setTFoco] = useState(treino.foco ?? '')
  const [tIni, setTIni] = useState(treino.data_inicio ?? '')
  const [tFim, setTFim] = useState(treino.data_fim ?? '')

  function onNome(v: string) {
    setNome(v)
    const lib = biblioteca?.find((b) => b.nome.toLowerCase() === v.toLowerCase())
    if (lib?.video_url) setVid(lib.video_url)
  }

  async function addEx(e: React.FormEvent) {
    e.preventDefault()
    if (!nome) return
    await createEx.mutateAsync({
      nome,
      series: series ? Number(series) : undefined,
      reps_prescritas: reps || undefined,
      carga_prescrita: carga || undefined,
      video_url: vid || undefined,
      observacoes: obs || undefined,
      dia_semana: dia === '' ? undefined : Number(dia),
      ordem: (exs?.length ?? 0) + 1,
    })
    setNome(''); setSeries(''); setReps(''); setCarga(''); setVid(''); setObs('')
  }

  async function saveTreino(e: React.FormEvent) {
    e.preventDefault()
    await updTreino.mutateAsync({
      treinoId: treino.treino_id,
      body: { nome: tNome, foco: tFoco || undefined, data_inicio: tIni || undefined, data_fim: tFim || undefined },
    })
    setEditT(false)
  }

  const grupos: Record<string, Exercicio[]> = {}
  ;(exs ?? []).forEach((ex) => {
    const k = ex.dia_semana == null ? 'Todo dia' : DIAS[ex.dia_semana]
    ;(grupos[k] ||= []).push(ex)
  })

  return (
    <Card variant="elevated">
      {editT ? (
        <form onSubmit={saveTreino} className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1.2fr_1.2fr] gap-3 items-end">
          <Input label="Treino" value={tNome} onChange={(e) => setTNome(e.target.value)} />
          <Input label="Foco" value={tFoco} onChange={(e) => setTFoco(e.target.value)} />
          <Input label="Início" type="date" value={tIni} onChange={(e) => setTIni(e.target.value)} />
          <Input label="Fim" type="date" value={tFim} onChange={(e) => setTFim(e.target.value)} />
          <div className="flex gap-2 sm:col-span-4">
            <Button type="submit" size="sm" disabled={updTreino.isPending}>Salvar</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditT(false)}>Cancelar</Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button className="flex items-center gap-2 text-left min-w-0" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
            <span className="min-w-0">
              <span className="font-medium">{treino.nome}</span>
              {treino.foco && <span className="text-xs text-text-muted ml-2">{treino.foco}</span>}
              {(treino.data_inicio || treino.data_fim) && (
                <span className="text-xs text-accent-hover/80 ml-2">
                  {fmtDate(treino.data_inicio)}{treino.data_fim ? ` – ${fmtDate(treino.data_fim)}` : ''}
                </span>
              )}
            </span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost" size="sm" iconOnly aria-label="Salvar como template"
              onClick={async () => {
                await saveAsTemplate.mutateAsync({ alunoId, treinoId: treino.treino_id, nome: treino.nome })
                show('Template salvo. Veja em "Templates".', 'success')
              }}
              disabled={saveAsTemplate.isPending}
            >
              <LayoutTemplate size={15} />
            </Button>
            <Button variant="ghost" size="sm" iconOnly aria-label="Editar treino" onClick={() => setEditT(true)}><Pencil size={15} /></Button>
            <Button variant="ghost" size="sm" iconOnly aria-label="Excluir treino" onClick={() => delTreino.mutate(treino.treino_id)} className="hover:text-danger"><Trash2 size={16} /></Button>
          </div>
        </div>
      )}

      {open && !editT && (
        <div className="mt-3 pl-2 sm:pl-6 space-y-2">
          {Object.entries(grupos).map(([d, list]) => (
            <div key={d}>
              <p className="text-xs text-accent-hover/80 mt-2 mb-1">{d}</p>
              {list.map((ex) => (
                <ExercicioRow key={ex.exercicio_id} alunoId={alunoId} treinoId={treino.treino_id} ex={ex} />
              ))}
            </div>
          ))}
          <form onSubmit={addEx} className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2">
            <Input placeholder="Exercício (busca biblioteca)" list={`lib-${treino.treino_id}`} value={nome} onChange={(e) => onNome(e.target.value)} className="col-span-2 sm:col-span-2" />
            <datalist id={`lib-${treino.treino_id}`}>
              {biblioteca?.map((b) => <option key={b.exlib_id} value={b.nome} />)}
            </datalist>
            <Input placeholder="Séries" value={series} onChange={(e) => setSeries(e.target.value)} />
            <Input placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} />
            <Input placeholder="Carga" value={carga} onChange={(e) => setCarga(e.target.value)} />
            <Select value={dia} onChange={(e) => setDia(e.target.value)}>
              <option value="">Todo dia</option>
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </Select>
            <Input placeholder="Vídeo" value={vid} onChange={(e) => setVid(e.target.value)} className="col-span-2 sm:col-span-2" />
            <Textarea placeholder="Observações (visíveis ao aluno na sessão)" value={obs} onChange={(e) => setObs(e.target.value)} rows={1} className="col-span-2 sm:col-span-5 min-h-0" />
            <Button type="submit" variant="ghost" size="sm" disabled={createEx.isPending} iconOnly aria-label="Adicionar exercício" className="col-span-2 sm:col-span-1">
              <Plus size={16} />
            </Button>
          </form>
        </div>
      )}
    </Card>
  )
}

function ExercicioRow({ alunoId, treinoId, ex }: { alunoId: string; treinoId: string; ex: Exercicio }) {
  const [edit, setEdit] = useState(false)
  const upd = useUpdateExercicio(alunoId, treinoId)
  const del = useDeleteExercicio(alunoId, treinoId)
  const [nome, setNome] = useState(ex.nome)
  const [series, setSeries] = useState(ex.series?.toString() ?? '')
  const [reps, setReps] = useState(ex.reps_prescritas ?? '')
  const [carga, setCarga] = useState(ex.carga_prescrita ?? '')
  const [vid, setVid] = useState(ex.video_url ?? '')
  const [dia, setDia] = useState(ex.dia_semana == null ? '' : String(ex.dia_semana))
  const [obs, setObs] = useState(ex.observacoes ?? '')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await upd.mutateAsync({
      exercicioId: ex.exercicio_id,
      body: {
        nome,
        series: series ? Number(series) : undefined,
        reps_prescritas: reps || undefined,
        carga_prescrita: carga || undefined,
        video_url: vid || undefined,
        observacoes: obs || undefined,
        dia_semana: dia === '' ? undefined : Number(dia),
        ordem: ex.ordem,
      },
    })
    setEdit(false)
  }

  if (edit)
    return (
      <form onSubmit={save} className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 py-1.5">
        <Input className="col-span-2" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input placeholder="Sér" value={series} onChange={(e) => setSeries(e.target.value)} />
        <Input placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} />
        <Select value={dia} onChange={(e) => setDia(e.target.value)}>
          <option value="">Todo dia</option>
          {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </Select>
        <Input placeholder="Carga" value={carga} onChange={(e) => setCarga(e.target.value)} />
        <Input className="col-span-2" placeholder="Vídeo" value={vid} onChange={(e) => setVid(e.target.value)} />
        <Textarea placeholder="Observações" value={obs} onChange={(e) => setObs(e.target.value)} rows={1} className="col-span-2 sm:col-span-6" />
        <div className="flex gap-1 col-span-2 sm:col-span-2">
          <Button type="submit" size="sm" iconOnly aria-label="Salvar exercício"><Check size={16} /></Button>
          <Button type="button" variant="ghost" size="sm" iconOnly aria-label="Cancelar edição" onClick={() => setEdit(false)}><X size={16} /></Button>
        </div>
      </form>
    )

  return (
    <div className="flex items-center justify-between gap-2 text-sm border-b border-border pb-1.5">
      <span className="min-w-0 truncate">
        {ex.nome}
        <span className="text-text-muted ml-2">
          {ex.series ? `${ex.series}x` : ''}{ex.reps_prescritas ?? ''} {ex.carga_prescrita ? `· ${ex.carga_prescrita}` : ''}
        </span>
        {ex.video_url && <a href={ex.video_url} target="_blank" rel="noreferrer" className="text-accent-hover ml-2 text-xs hover:underline">vídeo</a>}
        {ex.observacoes && (
          <span title={ex.observacoes} className="inline-block ml-2 align-text-bottom">
            <StickyNote size={12} className="text-warning" />
          </span>
        )}
      </span>
      <span className="flex gap-1 shrink-0">
        <Button variant="ghost" size="sm" iconOnly aria-label="Editar exercício" onClick={() => setEdit(true)}><Pencil size={13} /></Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Excluir exercício" onClick={() => del.mutate(ex.exercicio_id)} className="hover:text-danger"><Trash2 size={14} /></Button>
      </span>
    </div>
  )
}
