import { useRef, useState, type FormEvent } from 'react'
import { Send, Pin, Paperclip } from 'lucide-react'
import { Button } from '../ui'

const DIRETO_PREFIX = /^@personal\s*/i

export function ChatInputBar({
  onSend, onSendDireto, onAttach, disabled,
}: {
  onSend: (text: string) => void
  onSendDireto?: (text: string) => void
  onAttach?: (file: File) => void
  disabled?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || disabled) return
    if (DIRETO_PREFIX.test(t) && onSendDireto) {
      onSendDireto(t.replace(DIRETO_PREFIX, ''))
    } else {
      onSend(t)
    }
    setText('')
  }

  function sendDireto() {
    const t = text.trim().replace(DIRETO_PREFIX, '')
    if (!t || disabled || !onSendDireto) return
    onSendDireto(t)
    setText('')
  }

  const showSuggestion = !!onSendDireto && text.startsWith('@') && !DIRETO_PREFIX.test(text)

  return (
    <div className="border-t border-border bg-surface shrink-0">
      {showSuggestion && (
        <div className="px-3 pt-2">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setText('@personal ') }}
            className="text-xs px-2 py-0.5 rounded-full bg-energy/10 border border-energy/30 text-energy hover:bg-energy/20"
          >
            @personal
          </button>
        </div>
      )}
    <form onSubmit={submit} className="flex items-center gap-2 px-3 py-2">
      {onAttach && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onAttach(file)
              e.target.value = ''
            }}
          />
          <Button
            type="button" variant="outline" size="sm" iconOnly aria-label="Anexar foto ou vídeo"
            disabled={disabled} onClick={() => fileRef.current?.click()}
          >
            <Paperclip size={15} />
          </Button>
        </>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder="Digite uma mensagem… (@personal pra pergunta direta)"
        className="flex-1 px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text text-sm placeholder-text-muted focus:outline-none focus:border-accent disabled:opacity-50"
      />
      {onSendDireto && (
        <Button
          type="button" variant="outline" size="sm" iconOnly aria-label="Chamar personal (pergunta direta)"
          disabled={disabled || !text.trim()} onClick={sendDireto}
        >
          <Pin size={15} />
        </Button>
      )}
      <Button type="submit" variant="energy" size="sm" iconOnly aria-label="Enviar" disabled={disabled || !text.trim()}>
        <Send size={16} />
      </Button>
    </form>
    </div>
  )
}
