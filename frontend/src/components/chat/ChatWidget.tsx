import { useMemo, useState } from 'react'
import { MessageCircle, X, ChevronLeft, Search } from 'lucide-react'
import { useAlunos } from '../../hooks/useAlunos'
import { useExerciciosAluno } from '../../hooks/useEvolucao'
import { usePersonalChat, useSendPersonalChat, useEnviarCorrecao } from '../../hooks/usePersonalChat'
import { Avatar, Spinner, Modal, Select, Button } from '../ui'
import { ChatThread } from './ChatThread'
import { ChatInputBar } from './ChatInputBar'
import { useChatContext } from '../../context/ChatContext'

export function ChatWidget() {
  const { open, setOpen, alunoId, setAlunoId } = useChatContext()
  const [anexo, setAnexo] = useState<File | null>(null)
  const [busca, setBusca] = useState('')
  const alunos = useAlunos()
  const history = usePersonalChat(alunoId)
  const send = useSendPersonalChat(alunoId)
  const aluno = alunos.data?.find((a) => a.aluno_id === alunoId)
  const alunosFiltrados = useMemo(
    () => alunos.data?.filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase())) ?? [],
    [alunos.data, busca],
  )

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
        <div className="flex-1 flex flex-col min-h-0">
          {!!alunos.data?.length && (
            <div className="px-3 py-2 border-b border-border shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar aluno…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text text-sm placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {alunos.isLoading ? (
              <div className="p-6 flex justify-center"><Spinner /></div>
            ) : !alunos.data?.length ? (
              <p className="text-center text-sm text-text-muted p-6">Nenhum aluno cadastrado ainda.</p>
            ) : !alunosFiltrados.length ? (
              <p className="text-center text-sm text-text-muted p-6">Nenhum aluno encontrado.</p>
            ) : (
              alunosFiltrados.map((a) => (
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
        </div>
      ) : (
        <>
          <ChatThread
            messages={history.messages ?? []}
            isLoading={history.isLoading}
            viewerRole="PERSONAL"
            alunoNome={aluno?.nome}
            onLoadMore={() => history.fetchNextPage()}
            hasMore={history.hasNextPage}
            isLoadingMore={history.isFetchingNextPage}
          />
          <ChatInputBar
            onSend={(text) => send.mutate(text)}
            onAttach={(file) => setAnexo(file)}
            disabled={send.isPending}
          />
        </>
      )}

      <Modal open={!!anexo} onClose={() => setAnexo(null)} title="Anexar correção">
        {anexo && alunoId && (
          <CorrecaoForm
            alunoId={alunoId}
            file={anexo}
            onDone={() => setAnexo(null)}
          />
        )}
      </Modal>
    </div>
  )
}

function CorrecaoForm({
  alunoId, file, onDone,
}: { alunoId: string; file: File; onDone: () => void }) {
  const { data: exercicios } = useExerciciosAluno(alunoId)
  const correcao = useEnviarCorrecao(alunoId)
  const [exId, setExId] = useState('')
  const [texto, setTexto] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const ex = exercicios?.find((x) => x.exercicio_id === exId)
    if (!ex) return
    await correcao.mutateAsync({ file, exercicioId: ex.exercicio_id, exercicioNome: ex.nome, texto: texto.trim() || undefined })
    onDone()
  }

  if (!exercicios?.length) return <p className="text-sm text-text-muted">Este aluno não tem exercícios cadastrados.</p>

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-text-muted truncate">Arquivo: {file.name}</p>
      <Select label="Exercício" value={exId} onChange={(e) => setExId(e.target.value)} required>
        <option value="">Selecione…</option>
        {exercicios.map((ex) => <option key={ex.exercicio_id} value={ex.exercicio_id}>{ex.nome}</option>)}
      </Select>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Legenda (opcional)"
        className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text text-sm placeholder-text-muted focus:outline-none focus:border-accent"
      />
      <Button type="submit" className="w-full" disabled={!exId || correcao.isPending}>
        {correcao.isPending ? 'Enviando…' : 'Enviar correção'}
      </Button>
    </form>
  )
}
