import { useEffect, useRef } from 'react'
import { Bot, User, UserCog, Pin } from 'lucide-react'
import { Spinner } from '../ui'
import { renderMarkdownLite } from './markdownLite'
import type { Ator, ChatMensagem } from '../../types'

interface ChatThreadProps {
  messages: ChatMensagem[]
  isLoading?: boolean
  isSending?: boolean
  viewerRole: Ator
  alunoNome?: string
}

function formatHora(iso: string) {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const mesmoDia = d.toDateString() === new Date().toDateString()
  if (mesmoDia) return hora
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`
}

function Bubble({ msg, viewerRole, alunoNome }: { msg: ChatMensagem; viewerRole: Ator; alunoNome?: string }) {
  const isAssistant = msg.role === 'assistant'
  const isMine = !isAssistant && msg.ator === viewerRole
  const align = isMine ? 'items-end' : 'items-start'

  // Três estilos bem distintos: agente (neutro), eu (accent sólido), outra pessoa (info) —
  // ex.: o personal vê as msgs do aluno em "info", e vice-versa. "Direto" (pergunta marcada
  // pro personal, sem passar pelo agente) ganha um destaque próprio (energy) independente disso.
  const bubbleStyle = msg.direto
    ? 'bg-energy/10 border border-energy/40 text-text'
    : isAssistant
      ? 'bg-surface-elevated border border-border text-text'
      : isMine
        ? 'bg-accent text-white'
        : 'bg-info/10 border border-info/30 text-text'

  const Icon = msg.direto ? Pin : isAssistant ? Bot : msg.ator === 'PERSONAL' ? UserCog : User
  const label = msg.direto
    ? `${msg.ator === 'ALUNO' ? alunoNome ?? 'Aluno' : 'Personal'} · pergunta direta`
    : isAssistant
      ? 'Agente'
      : isMine
        ? null
        : (msg.ator === 'ALUNO' ? alunoNome ?? 'Aluno' : 'Personal') +
          (msg.canal_origem === 'WHATSAPP' ? ' · WhatsApp' : '')

  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      {label && (
        <span className="flex items-center gap-1 text-[10px] text-text-muted px-1">
          <Icon size={11} /> {label}
        </span>
      )}
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${bubbleStyle}`}>
        {isAssistant ? renderMarkdownLite(msg.texto) : msg.texto}
      </div>
      <span className="text-[10px] text-text-muted px-1">{formatHora(msg.data_hora)}</span>
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
