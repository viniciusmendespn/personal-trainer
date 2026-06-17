import { useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../ui'

export function ChatInputBar({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || disabled) return
    onSend(t)
    setText('')
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-3 py-2 border-t border-border bg-surface shrink-0">
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
  )
}
