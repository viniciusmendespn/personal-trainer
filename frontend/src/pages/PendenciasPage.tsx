import { useState } from 'react'
import { Bell, AlertTriangle, CalendarClock, Clock, Image, Camera, HelpCircle, Pin, Mail, Link2 } from 'lucide-react'
import { useNotificacoes, useMarkRead, useMarkAllRead, useVincularMidia } from '../hooks/useNotificacoes'
import { useAlunos } from '../hooks/useAlunos'
import { useExerciciosAluno } from '../hooks/useEvolucao'
import { Card, Spinner, Button, Badge, EmptyState, Select, Modal } from '../components/ui'
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

export function PendenciasPage() {
  const { data: items, isLoading } = useNotificacoes()
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const { data: alunos } = useAlunos()
  const [vincularItem, setVincularItem] = useState<Notificacao | null>(null)

  const nomeAluno = (id?: string) => alunos?.find((a) => a.aluno_id === id)?.nome

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
            <Card
              key={item.ref}
              variant="elevated"
              className={`flex items-start justify-between gap-3 ${!item.lida ? 'border-l-2 border-l-accent' : 'opacity-60'}`}
            >
              <div className="flex gap-2 min-w-0">
                <div className="mt-0.5 shrink-0">{TIPO_ICON[item.tipo] ?? <Bell size={16} className="text-text-muted" />}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    {item.titulo}
                    <Badge tone={TIPO_TONE[item.tipo] ?? 'neutral'}>{item.tipo}</Badge>
                    <Badge tone={item.lida ? 'neutral' : 'success'}>{item.lida ? 'Lida' : 'Não lida'}</Badge>
                  </p>
                  <p className="text-xs text-text-secondary">{item.mensagem}</p>
                  {item.aluno_id && <p className="text-xs text-text-muted">{nomeAluno(item.aluno_id)}</p>}
                  <p className="text-[11px] text-text-muted mt-0.5">{new Date(item.data_hora).toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {item.tipo === 'MIDIA_PENDENTE' && item.midia_id && (
                  <Button variant="ghost" size="sm" iconOnly aria-label="Vincular a exercício" onClick={() => setVincularItem(item)}>
                    <Link2 size={15} />
                  </Button>
                )}
                <Button
                  variant="ghost" size="sm" iconOnly
                  aria-label={item.lida ? 'Já lida' : 'Marcar como lida'}
                  disabled={item.lida}
                  onClick={() => !item.lida && markRead.mutate(item.ref)}
                >
                  <Mail size={16} />
                </Button>
              </div>
            </Card>
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
