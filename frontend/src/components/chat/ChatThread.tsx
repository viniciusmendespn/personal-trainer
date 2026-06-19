import { useEffect, useLayoutEffect, useRef } from 'react'
import { Bot, User, UserCog, Pin, PauseCircle, UserCheck } from 'lucide-react'
import { Spinner } from '../ui'
import { renderMarkdownLite } from './markdownLite'
import type { Ator, ChatMensagem } from '../../types'

interface ChatThreadProps {
  messages: ChatMensagem[]
  isLoading?: boolean
  isSending?: boolean
  viewerRole: Ator
  alunoNome?: string
  agentePausado?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  isLoadingMore?: boolean
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
  // ex.: o personal vê as msgs do aluno em "info", e vice-versa. "Direto" (mensagem direta,
  // sem passar pelo agente) ganha destaque próprio (energy), exceto quando é a MINHA própria
  // mensagem direta — nesse caso usa o estilo "eu" normal, senão eu veria minha msg com o
  // mesmo destaque usado pra chamar atenção pra mensagem de outra pessoa.
  const bubbleStyle = msg.direto
    ? isMine ? 'bg-accent text-white' : 'bg-energy/10 border border-energy/40 text-text'
    : isAssistant
      ? 'bg-surface-elevated border border-border text-text'
      : isMine
        ? 'bg-accent text-white'
        : 'bg-info/10 border border-info/30 text-text'

  const Icon = msg.direto ? Pin : isAssistant ? Bot : msg.ator === 'PERSONAL' ? UserCog : User
  const label = msg.direto
    ? isMine ? null : `${msg.ator === 'ALUNO' ? alunoNome ?? 'Aluno' : 'Personal'} · pergunta direta`
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
        {msg.midia?.url && (
          msg.midia.tipo.includes('video') ? (
            <video src={msg.midia.url} controls preload="none" className="rounded-lg max-w-full mt-2" />
          ) : (
            <img src={msg.midia.url} alt="Anexo" loading="lazy" className="rounded-lg max-w-full mt-2" />
          )
        )}
      </div>
      <span className="text-[10px] text-text-muted px-1">{formatHora(msg.data_hora)}</span>
    </div>
  )
}

export function ChatThread({
  messages, isLoading, isSending, viewerRole, alunoNome, agentePausado, onLoadMore, hasMore, isLoadingMore,
}: ChatThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevScrollHeight = useRef(0)
  const loadingMoreRef = useRef(false)

  // auto-rola pro fim em mensagem nova — não quando a mudança foi carregar histórico antigo
  useEffect(() => {
    if (loadingMoreRef.current) {
      loadingMoreRef.current = false
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isSending])

  // ao prepender mensagens antigas, mantém a posição visual (compensa a altura inserida no topo)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || !loadingMoreRef.current) return
    el.scrollTop += el.scrollHeight - prevScrollHeight.current
  }, [messages])

  function handleScroll() {
    const el = containerRef.current
    if (!el || !onLoadMore || !hasMore || isLoadingMore) return
    if (el.scrollTop < 80) {
      loadingMoreRef.current = true
      prevScrollHeight.current = el.scrollHeight
      onLoadMore()
    }
  }

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>

  return (
    <>
      {agentePausado && viewerRole === 'PERSONAL' && (
        <div className="bg-warning/10 border-b border-warning/30 px-4 py-2 text-xs text-warning flex items-center gap-1.5 shrink-0">
          <PauseCircle size={12} />
          Agente pausado — você está conversando diretamente
        </div>
      )}
      {agentePausado && viewerRole === 'ALUNO' && (
        <div className="bg-info/10 border-b border-info/30 px-4 py-2 text-xs text-info flex items-center gap-1.5 shrink-0">
          <UserCheck size={12} />
          Seu personal está respondendo diretamente
        </div>
      )}
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {isLoadingMore && (
        <div className="flex justify-center py-1"><Spinner className="w-4 h-4" /></div>
      )}
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
    </>
  )
}
