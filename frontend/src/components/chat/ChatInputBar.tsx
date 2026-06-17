import { useState, type FormEvent } from 'react'
import { Send, Pin } from 'lucide-react'
import { Button } from '../ui'

const DIRETO_PREFIX = /^@personal\s*/i

export function ChatInputBar({
  onSend, onSendDireto, disabled,
}: {
  onSend: (text: string) => void
  onSendDireto?: (text: string) => void
  disabled?: boolean
}) {
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

  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-3 py-2 border-t border-border bg-surface shrink-0">
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
  )
}
