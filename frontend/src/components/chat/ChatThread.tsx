import { useEffect, useRef } from 'react'
import { Bot } from 'lucide-react'
import { Spinner } from '../ui'
import type { Ator, ChatMensagem } from '../../types'

interface ChatThreadProps {
  messages: ChatMensagem[]
  isLoading?: boolean
  isSending?: boolean
  viewerRole: Ator
  alunoNome?: string
}

function Bubble({ msg, viewerRole, alunoNome }: { msg: ChatMensagem; viewerRole: Ator; alunoNome?: string }) {
  const isAssistant = msg.role === 'assistant'
  const isMine = !isAssistant && msg.ator === viewerRole
  const align = isMine ? 'items-end' : 'items-start'
  const bubbleStyle = isAssistant
    ? 'bg-surface-elevated border border-border text-text'
    : isMine
      ? 'bg-accent text-white'
      : 'bg-white/5 border border-border-strong text-text'

  const label = !isAssistant && !isMine
    ? (msg.ator === 'ALUNO' ? alunoNome ?? 'Aluno' : 'Personal') +
      (msg.canal_origem === 'WHATSAPP' ? ' · WhatsApp' : '')
    : null

  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      {label && <span className="text-[10px] text-text-muted px-1">{label}</span>}
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${bubbleStyle}`}>
        {msg.texto}
      </div>
    </div>
  )
}

export function ChatThread({ messages, isLoading, isSending, viewerRole, alunoNome }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isSending])

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {!messages.length && (
        <p className="text-center text-xs text-text-muted mt-8">Nenhuma mensagem ainda. Diga olá!</p>
      )}
      {messages.map((m) => <Bubble key={m.mensagem_id} msg={m} viewerRole={viewerRole} alunoNome={alunoNome} />)}
      {isSending && (
        <div className="flex items-center gap-2 text-text-muted text-xs px-1">
          <Bot size={14} /> digitando…
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
