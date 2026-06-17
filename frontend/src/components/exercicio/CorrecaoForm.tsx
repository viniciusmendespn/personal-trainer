import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Paperclip, X } from 'lucide-react'
import { treinosApi } from '../../api/treinos'
import { Button, Textarea, useToast } from '../ui'

interface Props {
  alunoId: string
  exercicioId: string
  exercicioNome?: string
  onDone?: () => void
}

interface FilePreview {
  file: File
  preview: string
}

export function CorrecaoForm({ alunoId, exercicioId, exercicioNome, onDone }: Props) {
  const qc = useQueryClient()
  const { show } = useToast()
  const [texto, setTexto] = useState('')
  const [files, setFiles] = useState<FilePreview[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    setFiles((prev) => [
      ...prev,
      ...picked.map((f) => ({ file: f, preview: URL.createObjectURL(f) })),
    ])
  }

  function removeFile(i: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[i].preview)
      return prev.filter((_, j) => j !== i)
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() && !files.length) return
    setLoading(true)
    try {
      // Upload each file and collect s3_keys
      const midias: Array<{ s3_key: string; tipo: string }> = []
      for (const { file } of files) {
        const { upload_url, s3_key } = await treinosApi.uploadUrlMidia(alunoId, file.name, file.type)
        await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
        const tipo = file.type.startsWith('video') ? 'video_correcao' : 'foto_correcao'
        midias.push({ s3_key, tipo })
      }
      await treinosApi.criarCorrecao(alunoId, { exercicio_id: exercicioId, exercicio_nome: exercicioNome, texto: texto.trim(), midias })
      qc.invalidateQueries({ queryKey: ['feed-exercicio', alunoId, exercicioId] })
      show('Correção publicada!', 'success')
      setTexto('')
      setFiles([])
      onDone?.()
    } catch {
      show('Erro ao publicar correção. Tente novamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        rows={3}
        placeholder="Escreva uma observação ou instrução de correção…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        disabled={loading}
      />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map(({ preview, file }, i) => (
            <div key={i} className="relative">
              {file.type.startsWith('video') ? (
                <video src={preview} className="h-20 w-20 object-cover rounded-lg border border-border" />
              ) : (
                <img src={preview} alt="" className="h-20 w-20 object-cover rounded-lg border border-border" />
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -top-1 -right-1 bg-surface rounded-full p-0.5 border border-border"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer hover:text-text transition-colors">
          <Paperclip size={13} /> Adicionar foto/vídeo
          <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={addFiles} disabled={loading} />
        </label>
        <Button type="submit" size="sm" className="ml-auto" disabled={loading || (!texto.trim() && !files.length)}>
          {loading ? 'Publicando…' : 'Publicar correção'}
        </Button>
      </div>
    </form>
  )
}
