import { useState } from 'react'
import { Plus, Trash2, Video, Pencil, Check, X } from 'lucide-react'
import { useBiblioteca, useCreateExLib, useUpdateExLib, useDeleteExLib } from '../hooks/useDominio'
import { Button, Card, Input, Spinner } from '../components/ui'
import type { ExLib } from '../types'

const taCls = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500'

export function BibliotecaPage() {
  const { data: exs, isLoading } = useBiblioteca()
  const create = useCreateExLib()
  const [nome, setNome] = useState('')
  const [grupo, setGrupo] = useState('')
  const [video, setVideo] = useState('')
  const [rec, setRec] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome) return
    await create.mutateAsync({ nome, grupo: grupo || undefined, video_url: video || undefined, recomendacoes: rec || undefined })
    setNome(''); setGrupo(''); setVideo(''); setRec('')
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Biblioteca de exercícios</h2>
      <p className="text-sm text-slate-500 mb-4">Catálogo reutilizável com vídeo e recomendações (o agente usa nas respostas).</p>

      <Card className="mb-6">
        <form onSubmit={submit} className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="w-44" />
            <Input label="Grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} className="w-32" />
            <Input label="Vídeo (URL)" value={video} onChange={(e) => setVideo(e.target.value)} className="flex-1 min-w-48" />
          </div>
          <textarea className={taCls} rows={2} placeholder="Recomendações (técnica, cuidados, dicas…)" value={rec} onChange={(e) => setRec(e.target.value)} />
          <Button type="submit" disabled={create.isPending}><span className="flex items-center gap-1"><Plus size={16} /> Adicionar</span></Button>
        </form>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !exs?.length ? (
        <p className="text-slate-500 text-sm">Catálogo vazio. Adicione exercícios acima.</p>
      ) : (
        <div className="space-y-2">
          {exs.map((ex) => <ExLibRow key={ex.exlib_id} ex={ex} />)}
        </div>
      )}
    </div>
  )
}

function ExLibRow({ ex }: { ex: ExLib }) {
  const [edit, setEdit] = useState(false)
  const upd = useUpdateExLib()
  const del = useDeleteExLib()
  const [nome, setNome] = useState(ex.nome)
  const [grupo, setGrupo] = useState(ex.grupo ?? '')
  const [video, setVideo] = useState(ex.video_url ?? '')
  const [rec, setRec] = useState(ex.recomendacoes ?? '')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await upd.mutateAsync({ id: ex.exlib_id, body: { nome, grupo: grupo || undefined, video_url: video || undefined, recomendacoes: rec || undefined } })
    setEdit(false)
  }

  if (edit)
    return (
      <Card>
        <form onSubmit={save} className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="w-44" />
            <Input value={grupo} onChange={(e) => setGrupo(e.target.value)} className="w-32" placeholder="Grupo" />
            <Input value={video} onChange={(e) => setVideo(e.target.value)} className="flex-1 min-w-48" placeholder="Vídeo" />
          </div>
          <textarea className={taCls} rows={2} placeholder="Recomendações" value={rec} onChange={(e) => setRec(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" disabled={upd.isPending}><Check size={16} /></Button>
            <Button type="button" variant="ghost" onClick={() => setEdit(false)}><X size={16} /></Button>
          </div>
        </form>
      </Card>
    )

  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="font-medium">{ex.nome} {ex.grupo && <span className="text-xs text-slate-500">· {ex.grupo}</span>}</p>
        {ex.video_url && (
          <a href={ex.video_url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 inline-flex items-center gap-1 hover:underline">
            <Video size={12} /> vídeo
          </a>
        )}
        {ex.recomendacoes && <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{ex.recomendacoes}</p>}
      </div>
      <span className="flex gap-2 shrink-0">
        <button onClick={() => setEdit(true)} className="text-slate-600 hover:text-slate-300"><Pencil size={15} /></button>
        <button onClick={() => del.mutate(ex.exlib_id)} className="text-slate-600 hover:text-red-400"><Trash2 size={16} /></button>
      </span>
    </Card>
  )
}
