import { useRef, useState } from 'react'
import { Send, UserRound, Dumbbell, Paperclip, X } from 'lucide-react'
import { Button, Textarea } from '../ui'
import type { Comentario } from '../../api/treinos'

type MidiaRef = { s3_key: string; tipo: string }
type MidiaItem = { url?: string; tipo: string }

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function MediaGrid({ midias }: { midias: MidiaItem[] }) {
  if (!midias.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {midias.map((m, i) =>
        m.url ? (
          m.tipo.startsWith('video') || m.tipo.includes('video') ? (
            <video key={i} src={m.url} controls className="rounded-lg max-h-32 max-w-[150px] border border-border" />
          ) : (
            <a key={i} href={m.url} target="_blank" rel="noreferrer">
              <img src={m.url} alt="mídia" className="rounded-lg max-h-32 max-w-[150px] border border-border object-cover" />
            </a>
          )
        ) : null,
      )}
    </div>
  )
}

interface BubbleProps {
  ator: 'ALUNO' | 'PERSONAL'
  texto?: string
  midias?: MidiaItem[]
  dataHora: string
  isViewer: boolean
}

function Bubble({ ator, texto, midias = [], dataHora, isViewer }: BubbleProps) {
  return (
    <div className={`flex gap-2 ${isViewer ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="shrink-0 mt-0.5">
        {ator === 'PERSONAL'
          ? <Dumbbell size={14} className="text-accent-hover" />
          : <UserRound size={14} className="text-text-muted" />}
      </div>
      <div className={`max-w-[85%] rounded-xl px-3 py-2 space-y-0.5 ${
        isViewer
          ? 'bg-accent/20 border border-accent/30 rounded-tr-sm'
          : 'bg-white/5 border border-border rounded-tl-sm'
      }`}>
        {texto && <p className="text-xs text-text leading-snug whitespace-pre-wrap">{texto}</p>}
        <MediaGrid midias={midias} />
        <p className="text-[10px] text-text-muted">{fmtDt(dataHora)}</p>
      </div>
    </div>
  )
}

interface ThreadRelatoProps {
  descricao?: string
  descricaoAtor?: 'ALUNO' | 'PERSONAL'
  descricaoDataHora: string
  comentarios?: Comentario[]
  viewerAtor: 'ALUNO' | 'PERSONAL'
  onAddComentario: (texto: string | undefined, midias: MidiaRef[]) => Promise<void>
  uploadMidia?: (file: File) => Promise<MidiaRef>
  isPending?: boolean
}

export function ThreadRelato({
  descricao,
  descricaoAtor = 'ALUNO',
  descricaoDataHora,
  comentarios = [],
  viewerAtor,
  onAddComentario,
  uploadMidia,
  isPending,
}: ThreadRelatoProps) {
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [files, setFiles] = useState<Array<{ file: File; preview: string }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    setFiles((prev) => [...prev, ...picked.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))])
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function handleSend() {
    const t = texto.trim() || undefined
    if (!t && !files.length) return
    setSending(true)
    try {
      const midias: MidiaRef[] = uploadMidia
        ? await Promise.all(files.map((f) => uploadMidia(f.file)))
        : []
      await onAddComentario(t, midias)
      files.forEach((f) => URL.revokeObjectURL(f.preview))
      setFiles([])
      setTexto('')
    } finally {
      setSending(false)
    }
  }

  const canSend = (texto.trim().length > 0 || files.length > 0) && !sending && !isPending

  return (
    <div className="space-y-2 mt-2">
      {descricao && (
        <Bubble
          ator={descricaoAtor}
          texto={descricao}
          dataHora={descricaoDataHora}
          isViewer={descricaoAtor === viewerAtor}
        />
      )}
      {comentarios.map((c) => (
        <Bubble
          key={c.com_id}
          ator={c.ator}
          texto={c.texto}
          midias={c.midias}
          dataHora={c.data_hora}
          isViewer={c.ator === viewerAtor}
        />
      ))}
      <div className="flex flex-col gap-1 pt-1">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {files.map(({ file, preview }, i) => (
              <div key={i} className="relative">
                {file.type.startsWith('video') ? (
                  <video src={preview} className="h-14 w-20 rounded object-cover border border-border" />
                ) : (
                  <img src={preview} alt="" className="h-14 w-20 rounded object-cover border border-border" />
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
        <Textarea
          rows={1}
          placeholder="Responder…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={sending || isPending}
          className="w-full resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <div className="flex items-center gap-2">
          {uploadMidia && (
            <label className="inline-flex items-center gap-1 text-xs text-text-secondary cursor-pointer hover:text-text transition-colors">
              <Paperclip size={12} /> Foto/vídeo
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={onFileChange}
                disabled={sending || isPending}
              />
            </label>
          )}
          <div className="flex-1" />
          <Button
            size="sm" variant="outline" iconOnly
            aria-label="Enviar"
            disabled={!canSend}
            onClick={handleSend}
          >
            <Send size={13} />
          </Button>
        </div>
      </div>
    </div>
  )
}
