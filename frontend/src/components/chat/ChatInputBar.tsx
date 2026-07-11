import { useRef, useState, type FormEvent } from 'react'
import { Send, Paperclip } from 'lucide-react'
import { Button } from '../ui'

export function ChatInputBar({
  onSend, onAttach, disabled,
}: {
  onSend: (text: string) => void
  onAttach?: (file: File) => void
  disabled?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || disabled) return
    onSend(t)
    setText('')
  }

  return (
    <div className="border-t border-border bg-surface shrink-0">
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
        placeholder="Digite uma mensagem…"
        className="flex-1 px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text text-sm placeholder-text-muted focus:outline-none focus:border-accent disabled:opacity-50"
      />
      <Button type="submit" variant="energy" size="sm" iconOnly aria-label="Enviar" disabled={disabled || !text.trim()}>
        <Send size={16} />
      </Button>
    </form>
    </div>
  )
}
