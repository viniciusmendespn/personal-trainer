import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AlertTriangle, CalendarClock, Clock, Image, Camera, HelpCircle, Pin, MailOpen, Link2, UserRound, Dumbbell, PlaySquare, MessageSquareDot } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNotificacoes, useMarkRead, useMarkAllRead, useVincularMidia } from '../hooks/useNotificacoes'
import { useAlunos } from '../hooks/useAlunos'
import { useExerciciosAluno } from '../hooks/useEvolucao'
import { Card, Spinner, Button, Badge, EmptyState, Select, Modal, useToast } from '../components/ui'
import { useChatContext } from '../context/ChatContext'
import { notifApi } from '../api/notificacoes'
import { ThreadRelato } from '../components/notificacoes/ThreadRelato'
import type { Notificacao } from '../api/notificacoes'

const TIPO_ICON: Record<string, React.ReactNode> = {
  DOR: <AlertTriangle size={16} className="text-danger" />,
  TREINO_FIM: <CalendarClock size={16} className="text-warning" />,
  PENDENCIA: <Clock size={16} className="text-warning" />,
  MIDIA_PENDENTE: <Image size={16} className="text-info" />,
  MIDIA: <Camera size={16} className="text-info" />,
  DUVIDA: <HelpCircle size={16} className="text-info" />,
  PERGUNTA_DIRETA: <Pin size={16} className="text-energy" />,
}
const TIPO_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  DOR: 'danger',
  TREINO_FIM: 'warning',
  PENDENCIA: 'warning',
  MIDIA_PENDENTE: 'info',
  MIDIA: 'info',
  DUVIDA: 'info',
  PERGUNTA_DIRETA: 'warning',
}

interface QuickAction {
  label: string
  icon: React.ReactNode
  fn: () => void
}

function useQuickAction(item: Notificacao, markRead: ReturnType<typeof useMarkRead>): QuickAction | null {
  const navigate = useNavigate()
  const { openChat } = useChatContext()

  if (!item.aluno_id) return null

  const doAndRead = (fn: () => void) => () => {
    fn()
    if (!item.lida) markRead.mutate(item.ref)
  }

  if (item.tipo === 'PERGUNTA_DIRETA') {
    return {
      label: 'Responder',
      icon: <MessageSquareDot size={15} />,
      fn: doAndRead(() => openChat(item.aluno_id!)),
    }
  }
  if (item.tipo === 'MIDIA') {
    const dest = item.exercicio_id
      ? `/alunos/${item.aluno_id}/evolucao?highlight=${item.exercicio_id}`
      : `/alunos/${item.aluno_id}/evolucao`
    return {
      label: 'Ver mídia',
      icon: <PlaySquare size={15} />,
      fn: doAndRead(() => navigate(dest)),
    }
  }
  if (item.tipo === 'DOR' || item.tipo === 'DUVIDA') {
    if (!item.relato_sk) {
      const dest = item.exercicio_id
        ? `/alunos/${item.aluno_id}/evolucao?highlight=${item.exercicio_id}`
        : `/alunos/${item.aluno_id}`
      return {
        label: 'Ver histórico',
        icon: item.tipo === 'DOR' ? <UserRound size={15} /> : <HelpCircle size={15} />,
        fn: doAndRead(() => navigate(dest)),
      }
    }
    // Has relato_sk — thread is shown via the "thread" button below
    return null
  }
  if (item.tipo === 'TREINO_FIM') {
    return {
      label: 'Abrir treino',
      icon: <Dumbbell size={15} />,
      fn: doAndRead(() => navigate(`/alunos/${item.aluno_id}`)),
    }
  }
  if (item.tipo === 'MIDIA_PENDENTE') {
    return {
      label: 'Ver aluno',
      icon: <UserRound size={15} />,
      fn: doAndRead(() => navigate(`/alunos/${item.aluno_id}`)),
    }
  }

  return null
}

function ThreadInline({ item }: { item: Notificacao }) {
  const qc = useQueryClient()
  const { show } = useToast()
  const relato = useQuery({
    queryKey: ['notif-relato', item.ref, item.aluno_id],
    queryFn: () => notifApi.getRelato(item.ref, item.aluno_id!),
    enabled: !!item.aluno_id,
  })

  const comentar = useMutation({
    mutationFn: (texto: string) => notifApi.comentarRelato({ ref: item.ref, aluno_id: item.aluno_id!, texto }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-relato', item.ref, item.aluno_id] })
      qc.invalidateQueries({ queryKey: ['notificacoes'] })
    },
    onError: () => show('Erro ao enviar comentário.', 'error'),
  })

  if (relato.isLoading) return <div className="mt-2"><Spinner /></div>
  if (!relato.data) return null

  return (
    <ThreadRelato
      descricao={relato.data.descricao}
      descricaoDataHora={relato.data.data_hora}
      comentarios={relato.data.comentarios}
      viewerAtor="PERSONAL"
      onAddComentario={async (texto) => { await comentar.mutateAsync(texto) }}
      isPending={comentar.isPending}
    />
  )
}

function NotifCard({ item, alunos, markRead, onVincular }: {
  item: Notificacao
  alunos: ReturnType<typeof useAlunos>['data']
  markRead: ReturnType<typeof useMarkRead>
  onVincular: (item: Notificacao) => void
}) {
  const [threadOpen, setThreadOpen] = useState(false)
  const quickAction = useQuickAction(item, markRead)
  const nomeAluno = alunos?.find((a) => a.aluno_id === item.aluno_id)?.nome
  const podeThread = (item.tipo === 'DOR' || item.tipo === 'DUVIDA') && !!item.relato_sk && !!item.aluno_id

  return (
    <Card
      variant="elevated"
      className={`${!item.lida ? 'border-l-2 border-l-accent' : 'opacity-60'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2 min-w-0">
          <div className="mt-0.5 shrink-0">{TIPO_ICON[item.tipo] ?? <Bell size={16} className="text-text-muted" />}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
              {item.titulo}
              <Badge tone={TIPO_TONE[item.tipo] ?? 'neutral'}>{item.tipo}</Badge>
              <Badge tone={item.lida ? 'neutral' : 'success'}>{item.lida ? 'Lida' : 'Não lida'}</Badge>
            </p>
            <p className="text-xs text-text-secondary">{item.mensagem}</p>
            {nomeAluno && <p className="text-xs text-text-muted">{nomeAluno}</p>}
            <p className="text-[11px] text-text-muted mt-0.5">{new Date(item.data_hora).toLocaleString('pt-BR')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {podeThread && (
            <Button variant="ghost" size="sm" iconOnly aria-label="Ver thread"
              onClick={() => {
                setThreadOpen((v) => !v)
                if (!item.lida) markRead.mutate(item.ref)
              }}>
              <MessageSquareDot size={15} className={threadOpen ? 'text-accent-hover' : ''} />
            </Button>
          )}
          {quickAction && (
            <Button variant="ghost" size="sm" iconOnly aria-label={quickAction.label} onClick={quickAction.fn}>
              {quickAction.icon}
            </Button>
          )}
          {item.tipo === 'MIDIA_PENDENTE' && item.midia_id && (
            <Button variant="ghost" size="sm" iconOnly aria-label="Vincular a exercício" onClick={() => onVincular(item)}>
              <Link2 size={15} />
            </Button>
          )}
          <Button
            variant="ghost" size="sm" iconOnly
            aria-label={item.lida ? 'Já lida' : 'Marcar como lida'}
            disabled={item.lida}
            onClick={() => !item.lida && markRead.mutate(item.ref)}
          >
            <MailOpen size={16} />
          </Button>
        </div>
      </div>
      {threadOpen && podeThread && (
        <ThreadInline item={item} />
      )}
    </Card>
  )
}

export function PendenciasPage() {
  const { data: items, isLoading } = useNotificacoes()
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const alunos = useAlunos()
  const [vincularItem, setVincularItem] = useState<Notificacao | null>(null)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Bell size={20} className="text-accent-hover" /> Notificações
        </h2>
        <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>Marcar todas como lidas</Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !items?.length ? (
        <EmptyState icon={<Bell />} title="Tudo em dia" description="Nenhuma notificação por aqui." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <NotifCard
              key={item.ref}
              item={item}
              alunos={alunos.data}
              markRead={markRead}
              onVincular={setVincularItem}
            />
          ))}
        </div>
      )}

      <Modal open={!!vincularItem} onClose={() => setVincularItem(null)} title="Vincular mídia a um exercício">
        {vincularItem && (
          <VincularMidiaForm item={vincularItem} onDone={() => setVincularItem(null)} />
        )}
      </Modal>
    </div>
  )
}

function VincularMidiaForm({ item, onDone }: { item: Notificacao; onDone: () => void }) {
  const { data: exercicios } = useExerciciosAluno(item.aluno_id ?? '')
  const vincular = useVincularMidia()
  const [exId, setExId] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const ex = exercicios?.find((x) => x.exercicio_id === exId)
    if (!ex || !item.midia_id) return
    await vincular.mutateAsync({
      ref: item.ref, aluno_id: item.aluno_id!, midia_id: item.midia_id,
      exercicio_id: ex.exercicio_id, exercicio_nome: ex.nome,
    })
    onDone()
  }

  if (!exercicios?.length) return <p className="text-sm text-text-muted">Este aluno não tem exercícios cadastrados.</p>

  return (
    <form onSubmit={submit} className="space-y-3">
      <Select label="Exercício" value={exId} onChange={(e) => setExId(e.target.value)} required>
        <option value="">Selecione…</option>
        {exercicios.map((ex) => <option key={ex.exercicio_id} value={ex.exercicio_id}>{ex.nome}</option>)}
      </Select>
      <Button type="submit" className="w-full" disabled={!exId || vincular.isPending}>
        {vincular.isPending ? 'Vinculando…' : 'Vincular'}
      </Button>
    </form>
  )
}
