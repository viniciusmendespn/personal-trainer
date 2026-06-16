import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, Pencil, TrendingUp, Scale, Check, X, Send } from 'lucide-react'
import { useAluno, useUpdateAluno, useDeleteAluno } from '../hooks/useAlunos'
import { alunosApi } from '../api/alunos'
import {
  useTreinos, useCreateTreino, useUpdateTreino, useDeleteTreino,
  useExercicios, useCreateExercicio, useUpdateExercicio, useDeleteExercicio,
} from '../hooks/useTreinos'
import { Button, Card, Input, Spinner } from '../components/ui'
import { useBiblioteca } from '../hooks/useDominio'
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
  const [nome, setNome] = useState('')
  const [foco, setFoco] = useState('')
  const [dtIni, setDtIni] = useState('')
  const [dtFim, setDtFim] = useState('')
  const [editing, setEditing] = useState(false)
  const [eNome, setENome] = useState('')
  const [eTel, setETel] = useState('')
  const [eObj, setEObj] = useState('')
  const [linkRes, setLinkRes] = useState<{ link: string; enviado: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const enviarLink = useMutation({
    mutationFn: () => alunosApi.enviarLink(alunoId),
    onSuccess: (d) => { setLinkRes(d); setCopied(false) },
  })
  function copyLink() {
    if (!linkRes) return
    navigator.clipboard?.writeText(linkRes.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function startEdit() {
    setENome(aluno?.nome ?? ''); setETel(aluno?.telefone ?? ''); setEObj(aluno?.objetivo ?? '')
    setEditing(true)
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    await updateAluno.mutateAsync({ nome: eNome, telefone: eTel, objetivo: eObj || undefined })
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
      <Link to="/alunos" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> Alunos
      </Link>

      {editing ? (
        <form onSubmit={saveEdit} className="space-y-2 mb-6 max-w-md">
          <Input label="Nome" value={eNome} onChange={(e) => setENome(e.target.value)} />
          <Input label="Telefone" value={eTel} onChange={(e) => setETel(e.target.value)} />
          <Input label="Objetivo" value={eObj} onChange={(e) => setEObj(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" disabled={updateAluno.isPending}>Salvar</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button type="button" variant="danger" onClick={remove} className="ml-auto">Excluir</Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">{aluno?.nome ?? '…'}</h2>
            <p className="text-sm text-slate-500">
              {aluno?.telefone} {aluno?.objetivo ? `· ${aluno.objetivo}` : ''} · {aluno?.status}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to={`/alunos/${alunoId}/evolucao`} className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:underline">
              <TrendingUp size={16} /> Evolução
            </Link>
            <Link to={`/alunos/${alunoId}/avaliacoes`} className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:underline">
              <Scale size={16} /> Avaliação
            </Link>
            <button onClick={() => enviarLink.mutate()} disabled={enviarLink.isPending}
              className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:underline disabled:opacity-50" title="Enviar link do app">
              <Send size={15} /> {enviarLink.isPending ? 'Enviando…' : 'Enviar app'}
            </button>
            <button onClick={startEdit} className="text-slate-500 hover:text-slate-300" title="Editar">
              <Pencil size={16} />
            </button>
          </div>
        </div>
      )}
      {linkRes && (
        <Card className="mb-4">
          <p className="text-xs text-slate-400 mb-2">
            {linkRes.enviado ? 'Link enviado no WhatsApp do aluno ✓ — você também pode copiar:' : 'WhatsApp não conectado — copie o link e envie ao aluno:'}
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={linkRes.link}
              onFocus={(e) => e.target.select()}
              className="flex-1 text-xs px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300"
            />
            <Button variant="ghost" onClick={copyLink}>{copied ? 'Copiado!' : 'Copiar'}</Button>
          </div>
        </Card>
      )}

      <form onSubmit={addTreino} className="mb-4 flex flex-wrap gap-2 items-end">
        <Input label="Treino" placeholder="ex: Treino A" value={nome} onChange={(e) => setNome(e.target.value)} className="w-44" />
        <Input label="Foco" placeholder="ex: Inferiores" value={foco} onChange={(e) => setFoco(e.target.value)} className="w-36" />
        <Input label="Início" type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} className="w-36" />
        <Input label="Fim" type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} className="w-36" />
        <Button type="submit" disabled={createTreino.isPending}>
          <Plus size={16} />
        </Button>
      </form>

      {isLoading ? (
        <Spinner />
      ) : !treinos?.length ? (
        <p className="text-slate-500 text-sm">Nenhum treino. Adicione acima.</p>
      ) : (
        <div className="space-y-3">
          {treinos.map((t) => (
            <TreinoCard key={t.treino_id} alunoId={alunoId} treino={t} />
          ))}
        </div>
      )}
    </div>
  )
}

const selCls = 'px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm'
const fmtDate = (d?: string) => (d ? d.split('-').reverse().slice(0, 2).join('/') : '')

function TreinoCard({ alunoId, treino }: { alunoId: string; treino: Treino }) {
  const [open, setOpen] = useState(false)
  const [editT, setEditT] = useState(false)
  const delTreino = useDeleteTreino(alunoId)
  const updTreino = useUpdateTreino(alunoId)
  const { data: exs } = useExercicios(alunoId, open ? treino.treino_id : '')
  const { data: biblioteca } = useBiblioteca()
  const createEx = useCreateExercicio(alunoId, treino.treino_id)
  const [nome, setNome] = useState('')
  const [series, setSeries] = useState('')
  const [reps, setReps] = useState('')
  const [carga, setCarga] = useState('')
  const [vid, setVid] = useState('')
  const [dia, setDia] = useState('')
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
      dia_semana: dia === '' ? undefined : Number(dia),
      ordem: (exs?.length ?? 0) + 1,
    })
    setNome(''); setSeries(''); setReps(''); setCarga(''); setVid('')
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
    <Card>
      {editT ? (
        <form onSubmit={saveTreino} className="flex flex-wrap gap-2 items-end">
          <Input label="Treino" value={tNome} onChange={(e) => setTNome(e.target.value)} className="w-40" />
          <Input label="Foco" value={tFoco} onChange={(e) => setTFoco(e.target.value)} className="w-32" />
          <Input label="Início" type="date" value={tIni} onChange={(e) => setTIni(e.target.value)} className="w-36" />
          <Input label="Fim" type="date" value={tFim} onChange={(e) => setTFim(e.target.value)} className="w-36" />
          <Button type="submit" disabled={updTreino.isPending}>Salvar</Button>
          <Button type="button" variant="ghost" onClick={() => setEditT(false)}>Cancelar</Button>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>
              <span className="font-medium">{treino.nome}</span>
              {treino.foco && <span className="text-xs text-slate-500 ml-2">{treino.foco}</span>}
              {(treino.data_inicio || treino.data_fim) && (
                <span className="text-xs text-emerald-400/70 ml-2">
                  {fmtDate(treino.data_inicio)}{treino.data_fim ? ` – ${fmtDate(treino.data_fim)}` : ''}
                </span>
              )}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditT(true)} className="text-slate-600 hover:text-slate-300"><Pencil size={15} /></button>
            <button onClick={() => delTreino.mutate(treino.treino_id)} className="text-slate-600 hover:text-red-400"><Trash2 size={16} /></button>
          </div>
        </div>
      )}

      {open && !editT && (
        <div className="mt-3 pl-6 space-y-2">
          {Object.entries(grupos).map(([d, list]) => (
            <div key={d}>
              <p className="text-xs text-emerald-400/70 mt-2 mb-1">{d}</p>
              {list.map((ex) => (
                <ExercicioRow key={ex.exercicio_id} alunoId={alunoId} treinoId={treino.treino_id} ex={ex} />
              ))}
            </div>
          ))}
          <form onSubmit={addEx} className="flex flex-wrap gap-2 pt-2">
            <Input placeholder="Exercício (busca biblioteca)" list={`lib-${treino.treino_id}`} value={nome} onChange={(e) => onNome(e.target.value)} className="flex-1 min-w-32" />
            <datalist id={`lib-${treino.treino_id}`}>
              {biblioteca?.map((b) => <option key={b.exlib_id} value={b.nome} />)}
            </datalist>
            <Input placeholder="Séries" value={series} onChange={(e) => setSeries(e.target.value)} className="w-16" />
            <Input placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} className="w-20" />
            <Input placeholder="Carga" value={carga} onChange={(e) => setCarga(e.target.value)} className="w-20" />
            <select value={dia} onChange={(e) => setDia(e.target.value)} className={selCls}>
              <option value="">Todo dia</option>
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <Input placeholder="Vídeo" value={vid} onChange={(e) => setVid(e.target.value)} className="flex-1 min-w-32" />
            <Button type="submit" variant="ghost" disabled={createEx.isPending}><Plus size={16} /></Button>
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
        dia_semana: dia === '' ? undefined : Number(dia),
        ordem: ex.ordem,
      },
    })
    setEdit(false)
  }

  if (edit)
    return (
      <form onSubmit={save} className="flex flex-wrap gap-1 py-1 items-center">
        <input className={`${selCls} flex-1 min-w-28`} value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className={`${selCls} w-14`} placeholder="Sér" value={series} onChange={(e) => setSeries(e.target.value)} />
        <input className={`${selCls} w-16`} placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} />
        <input className={`${selCls} w-16`} placeholder="Carga" value={carga} onChange={(e) => setCarga(e.target.value)} />
        <select className={selCls} value={dia} onChange={(e) => setDia(e.target.value)}>
          <option value="">Todo dia</option>
          {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <input className={`${selCls} flex-1 min-w-24`} placeholder="Vídeo" value={vid} onChange={(e) => setVid(e.target.value)} />
        <button type="submit" className="text-emerald-400"><Check size={16} /></button>
        <button type="button" onClick={() => setEdit(false)} className="text-slate-500"><X size={16} /></button>
      </form>
    )

  return (
    <div className="flex items-center justify-between text-sm border-b border-slate-800 pb-1">
      <span>
        {ex.nome}
        <span className="text-slate-500 ml-2">
          {ex.series ? `${ex.series}x` : ''}{ex.reps_prescritas ?? ''} {ex.carga_prescrita ? `· ${ex.carga_prescrita}` : ''}
        </span>
        {ex.video_url && <a href={ex.video_url} target="_blank" rel="noreferrer" className="text-emerald-400 ml-2 text-xs hover:underline">vídeo</a>}
      </span>
      <span className="flex gap-2">
        <button onClick={() => setEdit(true)} className="text-slate-600 hover:text-slate-300"><Pencil size={13} /></button>
        <button onClick={() => del.mutate(ex.exercicio_id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
      </span>
    </div>
  )
}
