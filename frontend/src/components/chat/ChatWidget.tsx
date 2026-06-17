import { useState } from 'react'
import { MessageCircle, X, ChevronLeft } from 'lucide-react'
import { useAlunos } from '../../hooks/useAlunos'
import { usePersonalChat, useSendPersonalChat } from '../../hooks/usePersonalChat'
import { Avatar, Spinner } from '../ui'
import { ChatThread } from './ChatThread'
import { ChatInputBar } from './ChatInputBar'

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [alunoId, setAlunoId] = useState<string | null>(null)
  const alunos = useAlunos()
  const history = usePersonalChat(alunoId)
  const send = useSendPersonalChat(alunoId)
  const aluno = alunos.data?.find((a) => a.aluno_id === alunoId)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir chat"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-accent hover:bg-accent-hover text-white shadow-[var(--shadow-glow-accent)] flex items-center justify-center transition-colors"
      >
        <MessageCircle size={24} />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-5 sm:right-5 z-40 sm:w-[400px] sm:max-w-[calc(100vw-2.5rem)] sm:h-[600px] sm:max-h-[calc(100vh-2.5rem)] sm:rounded-2xl overflow-hidden bg-surface border border-border shadow-2xl flex flex-col">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-elevated shrink-0">
        {alunoId && (
          <button onClick={() => setAlunoId(null)} aria-label="Voltar" className="p-1 -ml-1 text-text-secondary hover:text-text">
            <ChevronLeft size={18} />
          </button>
        )}
        <h3 className="font-display font-semibold text-text flex-1 truncate">
          {aluno ? aluno.nome : 'Conversas'}
        </h3>
        <button onClick={() => setOpen(false)} aria-label="Fechar" className="p-1 text-text-secondary hover:text-text">
          <X size={18} />
        </button>
      </header>

      {!alunoId ? (
        <div className="flex-1 overflow-y-auto">
          {alunos.isLoading ? (
            <div className="p-6 flex justify-center"><Spinner /></div>
          ) : !alunos.data?.length ? (
            <p className="text-center text-sm text-text-muted p-6">Nenhum aluno cadastrado ainda.</p>
          ) : (
            alunos.data.map((a) => (
              <button
                key={a.aluno_id}
                onClick={() => setAlunoId(a.aluno_id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left border-b border-border/50"
              >
                <Avatar name={a.nome} size="sm" />
                <span className="text-sm text-text truncate">{a.nome}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <ChatThread
            messages={history.messages ?? []}
            isLoading={history.isLoading}
            isSending={send.isPending}
            viewerRole="PERSONAL"
            alunoNome={aluno?.nome}
            onLoadMore={() => history.fetchNextPage()}
            hasMore={history.hasNextPage}
            isLoadingMore={history.isFetchingNextPage}
          />
          <ChatInputBar onSend={(text) => send.mutate(text)} disabled={send.isPending} />
        </>
      )}
    </div>
  )
}
