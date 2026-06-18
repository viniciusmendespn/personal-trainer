import { useRef, useState } from 'react'
import { AlertTriangle, Camera, HelpCircle, MessageCircle, Paperclip, Send, Wrench, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Textarea, useToast } from '../ui'
import { alunoApi } from '../../api/alunoApp'
import { treinosApi } from '../../api/treinos'

type TipoAluno = 'EXECUCAO' | 'DOR' | 'DUVIDA' | 'OUTRO'
type TipoPersonal = 'CORRECAO' | 'EXECUCAO' | 'OUTRO'

interface FilePreview {
  file: File
  preview: string
}

interface PostComposerProps {
  exercicioId: string
  exercicioNome?: string
  viewerAtor: 'ALUNO' | 'PERSONAL'
  alunoId?: string   // obrigatório quando viewerAtor === 'PERSONAL'
  onSuccess?: () => void
}

const TIPO_CONFIG_ALUNO: Record<TipoAluno, { label: string; icon: React.ReactNode; placeholder: string; color: string }> = {
  EXECUCAO: {
    label: 'Execução',
    icon: <Camera size={13} />,
    placeholder: 'Conta como foi a execução, série ou carga…',
    color: 'bg-success/10 border-success/30 text-success',
  },
  DOR: {
    label: 'Dor',
    icon: <AlertTriangle size={13} />,
    placeholder: 'Onde sentiu? Como foi?',
    color: 'bg-danger/10 border-danger/30 text-danger',
  },
  DUVIDA: {
    label: 'Dúvida',
    icon: <HelpCircle size={13} />,
    placeholder: 'Qual sua dúvida sobre este exercício?',
    color: 'bg-info/10 border-info/30 text-info',
  },
  OUTRO: {
    label: 'Outro',
    icon: <MessageCircle size={13} />,
    placeholder: 'Descreva o que aconteceu…',
    color: 'bg-surface-elevated border-border-strong text-text-secondary',
  },
}

const TIPO_CONFIG_PERSONAL: Record<TipoPersonal, { label: string; icon: React.ReactNode; placeholder: string; color: string }> = {
  CORRECAO: {
    label: 'Correção',
    icon: <Wrench size={13} />,
    placeholder: 'Escreva sua correção para o aluno…',
    color: 'bg-accent/10 border-accent/30 text-accent-hover',
  },
  EXECUCAO: {
    label: 'Demonstração',
    icon: <Camera size={13} />,
    placeholder: 'Poste uma demonstração do exercício…',
    color: 'bg-success/10 border-success/30 text-success',
  },
  OUTRO: {
    label: 'Observação',
    icon: <MessageCircle size={13} />,
    placeholder: 'Escreva uma observação para o aluno…',
    color: 'bg-surface-elevated border-border-strong text-text-secondary',
  },
}

export function PostComposer({ exercicioId, exercicioNome, viewerAtor, alunoId, onSuccess }: PostComposerProps) {
  const qc = useQueryClient()
  const { show } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [tipoAluno, setTipoAluno] = useState<TipoAluno>('EXECUCAO')
  const [tipoPersonal, setTipoPersonal] = useState<TipoPersonal>('CORRECAO')
  const [descricao, setDescricao] = useState('')
  const [files, setFiles] = useState<FilePreview[]>([])
  const [loading, setLoading] = useState(false)

  const isPersonal = viewerAtor === 'PERSONAL'
  const cfg = isPersonal ? TIPO_CONFIG_PERSONAL[tipoPersonal] : TIPO_CONFIG_ALUNO[tipoAluno]
  const showFileButton = true

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    const previews = picked.map((file) => ({ file, preview: URL.createObjectURL(file) }))
    setFiles((prev) => [...prev, ...previews])
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function uploadFile(file: File): Promise<{ s3_key: string; tipo: string }> {
    const { upload_url, s3_key } = isPersonal && alunoId
      ? await treinosApi.uploadUrlMidia(alunoId, file.name, file.type)
      : await alunoApi.midiaUploadUrl(file.name, file.type)
    await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    const isVideo = file.type.startsWith('video')
    const midiaTipo = isPersonal
      ? (isVideo ? 'video_correcao' : 'foto_correcao')
      : (isVideo ? 'video_execucao' : 'foto_exercicio')
    return { s3_key, tipo: midiaTipo }
  }

  async function submit() {
    if (!descricao.trim() && !files.length) return
    setLoading(true)
    try {
      const midias = await Promise.all(files.map((f) => uploadFile(f.file)))

      if (isPersonal && alunoId) {
        await treinosApi.criarPostagemPersonal(alunoId, exercicioId, {
          tipo: tipoPersonal,
          exercicio_nome: exercicioNome,
          descricao: descricao.trim() || undefined,
          midias,
        })
        qc.invalidateQueries({ queryKey: ['feed-exercicio', alunoId, exercicioId] })
      } else {
        await alunoApi.criarPostagem(exercicioId, {
          tipo: tipoAluno,
          exercicio_nome: exercicioNome,
          descricao: descricao.trim() || undefined,
          midias,
        })
        qc.invalidateQueries({ queryKey: ['aluno-feed', exercicioId] })
      }

      files.forEach((f) => URL.revokeObjectURL(f.preview))
      setFiles([])
      setDescricao('')
      setOpen(false)
      show(isPersonal ? 'Postagem enviada!' : 'Enviado! Seu personal vai ver.', 'success')
      onSuccess?.()
    } catch {
      show('Não foi possível enviar. Tente novamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-xs text-text-muted hover:border-accent hover:text-accent transition-colors"
      >
        {isPersonal ? <Wrench size={13} /> : <Paperclip size={13} />}
        {isPersonal ? 'Postar no feed deste exercício' : 'Postar execução, dor, dúvida ou outro'}
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-3">
      {/* Seletor de tipo */}
      {isPersonal ? (
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(TIPO_CONFIG_PERSONAL) as TipoPersonal[]).map((t) => {
            const c = TIPO_CONFIG_PERSONAL[t]
            const active = tipoPersonal === t
            return (
              <button
                key={t}
                onClick={() => setTipoPersonal(t)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                  active ? c.color : 'border-border text-text-muted hover:border-border-strong'
                }`}
              >
                {c.icon} {c.label}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(TIPO_CONFIG_ALUNO) as TipoAluno[]).map((t) => {
            const c = TIPO_CONFIG_ALUNO[t]
            const active = tipoAluno === t
            return (
              <button
                key={t}
                onClick={() => setTipoAluno(t)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                  active ? c.color : 'border-border text-text-muted hover:border-border-strong'
                }`}
              >
                {c.icon} {c.label}
              </button>
            )
          })}
        </div>
      )}

      <Textarea
        rows={2}
        placeholder={cfg.placeholder}
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
        }}
      />

      {/* Previews de arquivos */}
      {!!files.length && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative">
              {f.file.type.startsWith('video') ? (
                <video src={f.preview} className="h-16 w-24 rounded object-cover border border-border" />
              ) : (
                <img src={f.preview} alt="" className="h-16 w-24 rounded object-cover border border-border" />
              )}
              <button
                onClick={() => removeFile(i)}
                className="absolute -top-1 -right-1 bg-danger text-white rounded-full p-0.5"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {showFileButton && (
          <label className="inline-flex items-center gap-1 text-xs text-text-secondary cursor-pointer hover:text-text transition-colors">
            <Paperclip size={13} /> Foto/vídeo
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onFileChange} />
          </label>
        )}
        <div className="flex-1" />
        <button
          onClick={() => { files.forEach((f) => URL.revokeObjectURL(f.preview)); setFiles([]); setDescricao(''); setOpen(false) }}
          className="text-xs text-text-muted hover:text-text"
        >
          Cancelar
        </button>
        <Button
          size="sm"
          variant="energy"
          onClick={submit}
          disabled={loading || (!descricao.trim() && !files.length)}
        >
          <Send size={13} /> {loading ? 'Enviando…' : 'Enviar'}
        </Button>
      </div>
    </div>
  )
}
