import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, Pencil, TrendingUp, Scale } from 'lucide-react'
import { useAluno, useUpdateAluno, useDeleteAluno } from '../hooks/useAlunos'
import {
  useTreinos, useCreateTreino, useDeleteTreino,
  useExercicios, useCreateExercicio, useDeleteExercicio,
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
  const [dias, setDias] = useState<number[]>([])
  const [editing, setEditing] = useState(false)
  const [eNome, setENome] = useState('')
  const [eTel, setETel] = useState('')
  const [eObj, setEObj] = useState('')

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
    await createTreino.mutateAsync({ nome, foco: foco || undefined, dias_semana: dias, ordem: (treinos?.length ?? 0) + 1 })
    setNome(''); setFoco(''); setDias([])
  }
  const toggleDia = (d: number) => setDias((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))

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
            <button onClick={startEdit} className="text-slate-500 hover:text-slate-300" title="Editar">
              <Pencil size={16} />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={addTreino} className="mb-4 space-y-2">
        <div className="flex gap-2">
          <Input placeholder="Nome do treino (ex: Treino A)" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input placeholder="Foco (ex: Inferiores)" value={foco} onChange={(e) => setFoco(e.target.value)} />
          <Button type="submit" disabled={createTreino.isPending}>
            <Plus size={16} />
          </Button>
        </div>
        <div className="flex gap-1">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDia(i)}
              className={`text-xs px-2 py-1 rounded ${dias.includes(i) ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              {d}
            </button>
          ))}
        </div>
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

function TreinoCard({ alunoId, treino }: { alunoId: string; treino: Treino }) {
  const [open, setOpen] = useState(false)
  const delTreino = useDeleteTreino(alunoId)
  const { data: exs } = useExercicios(alunoId, open ? treino.treino_id : '')
  const { data: biblioteca } = useBiblioteca()
  const createEx = useCreateExercicio(alunoId, treino.treino_id)
  const delEx = useDeleteExercicio(alunoId, treino.treino_id)
  const [nome, setNome] = useState('')
  const [series, setSeries] = useState('')
  const [reps, setReps] = useState('')
  const [carga, setCarga] = useState('')
  const [vid, setVid] = useState('')
  const [dia, setDia] = useState('')

  function onNome(v: string) {
    setNome(v)
    const lib = biblioteca?.find((b) => b.nome.toLowerCase() === v.toLowerCase())
    if (lib?.video_url) setVid(lib.video_url)   // puxa o vídeo da biblioteca
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

  const grupos: Record<string, Exercicio[]> = {}
  ;(exs ?? []).forEach((ex) => {
    const k = ex.dia_semana == null ? 'Todo dia' : DIAS[ex.dia_semana]
    ;(grupos[k] ||= []).push(ex)
  })

  return (
    <Card>
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>
            <span className="font-medium">{treino.nome}</span>
            {treino.foco && <span className="text-xs text-slate-500 ml-2">{treino.foco}</span>}
            {!!treino.dias_semana?.length && (
              <span className="text-xs text-emerald-400/80 ml-2">
                {treino.dias_semana.slice().sort().map((d) => ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][d]).join(' ')}
              </span>
            )}
          </span>
        </button>
        <button onClick={() => delTreino.mutate(treino.treino_id)} className="text-slate-600 hover:text-red-400">
          <Trash2 size={16} />
        </button>
      </div>

      {open && (
        <div className="mt-3 pl-6 space-y-2">
          {Object.entries(grupos).map(([d, list]) => (
            <div key={d}>
              <p className="text-xs text-emerald-400/70 mt-2 mb-1">{d}</p>
              {list.map((ex) => (
                <div key={ex.exercicio_id} className="flex items-center justify-between text-sm border-b border-slate-800 pb-1">
                  <span>
                    {ex.nome}
                    <span className="text-slate-500 ml-2">
                      {ex.series ? `${ex.series}x` : ''}{ex.reps_prescritas ?? ''} {ex.carga_prescrita ? `· ${ex.carga_prescrita}` : ''}
                    </span>
                    {ex.video_url && (
                      <a href={ex.video_url} target="_blank" rel="noreferrer" className="text-emerald-400 ml-2 text-xs hover:underline">vídeo</a>
                    )}
                  </span>
                  <button onClick={() => delEx.mutate(ex.exercicio_id)} className="text-slate-600 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
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
            <select value={dia} onChange={(e) => setDia(e.target.value)}
              className="px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm">
              <option value="">Todo dia</option>
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <Input placeholder="Vídeo" value={vid} onChange={(e) => setVid(e.target.value)} className="flex-1 min-w-32" />
            <Button type="submit" variant="ghost" disabled={createEx.isPending}>
              <Plus size={16} />
            </Button>
          </form>
        </div>
      )}
    </Card>
  )
}
