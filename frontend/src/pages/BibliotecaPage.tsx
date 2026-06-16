import { useState } from 'react'
import { Plus, Trash2, Video } from 'lucide-react'
import { useBiblioteca, useCreateExLib, useDeleteExLib } from '../hooks/useDominio'
import { Button, Card, Input, Spinner } from '../components/ui'

export function BibliotecaPage() {
  const { data: exs, isLoading } = useBiblioteca()
  const create = useCreateExLib()
  const del = useDeleteExLib()
  const [nome, setNome] = useState('')
  const [grupo, setGrupo] = useState('')
  const [video, setVideo] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome) return
    await create.mutateAsync({ nome, grupo: grupo || undefined, video_url: video || undefined })
    setNome(''); setGrupo(''); setVideo('')
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Biblioteca de exercícios</h2>
      <p className="text-sm text-slate-500 mb-4">Catálogo reutilizável com vídeo de referência (o agente usa nas respostas).</p>

      <Card className="mb-6">
        <form onSubmit={submit} className="flex flex-wrap gap-2 items-end">
          <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="w-44" />
          <Input label="Grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} className="w-32" />
          <Input label="Vídeo (URL)" value={video} onChange={(e) => setVideo(e.target.value)} className="flex-1 min-w-48" />
          <Button type="submit" disabled={create.isPending}><Plus size={16} /></Button>
        </form>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !exs?.length ? (
        <p className="text-slate-500 text-sm">Catálogo vazio. Adicione exercícios acima.</p>
      ) : (
        <div className="space-y-2">
          {exs.map((ex) => (
            <Card key={ex.exlib_id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{ex.nome} {ex.grupo && <span className="text-xs text-slate-500">· {ex.grupo}</span>}</p>
                {ex.video_url && (
                  <a href={ex.video_url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 inline-flex items-center gap-1 hover:underline">
                    <Video size={12} /> vídeo
                  </a>
                )}
              </div>
              <button onClick={() => del.mutate(ex.exlib_id)} className="text-slate-600 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
