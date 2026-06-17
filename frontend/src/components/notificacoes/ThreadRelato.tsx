import { useState } from 'react'
import { Send, UserRound, Dumbbell } from 'lucide-react'
import { Button, Textarea } from '../ui'
import type { Comentario } from '../../api/treinos'

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

interface BubbleProps {
  ator: 'ALUNO' | 'PERSONAL'
  texto: string
  dataHora: string
  isViewer: boolean
}

function Bubble({ ator, texto, dataHora, isViewer }: BubbleProps) {
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
        <p className="text-xs text-text leading-snug whitespace-pre-wrap">{texto}</p>
        <p className="text-[10px] text-text-muted">{fmtDt(dataHora)}</p>
      </div>
    </div>
  )
}

interface ThreadRelatoProps {
  descricao: string
  descricaoAtor?: 'ALUNO' | 'PERSONAL'
  descricaoDataHora: string
  comentarios?: Comentario[]
  viewerAtor: 'ALUNO' | 'PERSONAL'
  onAddComentario: (texto: string) => Promise<void>
  isPending?: boolean
}

export function ThreadRelato({
  descricao,
  descricaoAtor = 'ALUNO',
  descricaoDataHora,
  comentarios = [],
  viewerAtor,
  onAddComentario,
  isPending,
}: ThreadRelatoProps) {
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const t = texto.trim()
    if (!t) return
    setSending(true)
    try {
      await onAddComentario(t)
      setTexto('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-2 mt-2">
      <Bubble
        ator={descricaoAtor}
        texto={descricao}
        dataHora={descricaoDataHora}
        isViewer={descricaoAtor === viewerAtor}
      />
      {comentarios.map((c) => (
        <Bubble
          key={c.com_id}
          ator={c.ator}
          texto={c.texto}
          dataHora={c.data_hora}
          isViewer={c.ator === viewerAtor}
        />
      ))}
      <div className="flex gap-2 pt-1 items-end">
        <Textarea
          rows={1}
          placeholder="Responder…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={sending || isPending}
          className="flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <Button
          size="sm" variant="outline" iconOnly
          aria-label="Enviar"
          disabled={!texto.trim() || sending || isPending}
          onClick={handleSend}
        >
          <Send size={13} />
        </Button>
      </div>
    </div>
  )
}
