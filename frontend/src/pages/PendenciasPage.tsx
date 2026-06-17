import { useMemo, useState } from 'react'
import { Bell, Check, Clock, AlertTriangle, CalendarClock, Image, Link2, HelpCircle, Pin, Camera } from 'lucide-react'
import { useCentral, useVincularMidia } from '../hooks/useCentral'
import { useMarkRead, useMarkAllRead, useResolvePendencia } from '../hooks/useNotificacoes'
import { useAlunos } from '../hooks/useAlunos'
import { useExerciciosAluno } from '../hooks/useEvolucao'
import { Card, Spinner, Button, Tabs, Badge, EmptyState, Select, Modal } from '../components/ui'
import type { CentralItem } from '../api/central'

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
  const { data, isLoading } = useCentral()
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const resolveP = useResolvePendencia()
  const { data: alunos } = useAlunos()
  const [tab, setTab] = useState<'tudo' | 'notif' | 'pend'>('tudo')
  const [vincularItem, setVincularItem] = useState<CentralItem | null>(null)

  const items = useMemo(() => {
    const all = data?.items ?? []
    if (tab === 'notif') return all.filter((i) => i.kind === 'NOTIF')
    if (tab === 'pend') return all.filter((i) => i.kind === 'PENDENCIA')
    return all
  }, [data, tab])

  const nomeAluno = (id?: string) => alunos?.find((a) => a.aluno_id === id)?.nome

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Bell size={20} className="text-accent-hover" /> Central
        </h2>
        <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>Marcar notificações como lidas</Button>
      </div>

      <Tabs
        className="mb-4"
        tabs={[
          { key: 'tudo', label: 'Tudo', badge: data?.total },
          { key: 'notif', label: 'Notificações' },
          { key: 'pend', label: 'Pendências' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {isLoading ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState icon={<Bell />} title="Tudo em dia" description="Nenhuma notificação ou pendência por aqui." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isNotif = item.kind === 'NOTIF'
            const tipo = isNotif ? item.tipo : item.tipo
            return (
              <Card key={item.ref} variant="elevated" className={`flex items-start justify-between gap-3 ${isNotif && item.lida ? 'opacity-60' : ''}`}>
                <div className="flex gap-2 min-w-0">
                  <div className="mt-0.5 shrink-0">{TIPO_ICON[tipo] ?? <Bell size={16} className="text-text-muted" />}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                      {isNotif ? item.titulo : tipo}
                      <Badge tone={TIPO_TONE[tipo] ?? 'neutral'}>{isNotif ? 'Notificação' : 'Pendência'}</Badge>
                    </p>
                    <p className="text-xs text-text-secondary">{isNotif ? item.mensagem : item.motivo}</p>
                    {!isNotif && item.aluno_id && <p className="text-xs text-text-muted">{nomeAluno(item.aluno_id)}</p>}
                    <p className="text-[11px] text-text-muted mt-0.5">{new Date(item.data_hora).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isNotif && tipo === 'MIDIA_PENDENTE' && item.payload?.midia_id && (
                    <Button variant="ghost" size="sm" iconOnly aria-label="Vincular a exercício" onClick={() => setVincularItem(item)}>
                      <Link2 size={15} />
                    </Button>
                  )}
                  {isNotif && !item.lida && (
                    <Button variant="ghost" size="sm" iconOnly aria-label="Marcar como lida" onClick={() => markRead.mutate(item.ref)}>
                      <Check size={16} />
                    </Button>
                  )}
                  {!isNotif && (
                    <Button variant="ghost" size="sm" iconOnly aria-label="Resolver pendência" onClick={() => resolveP.mutate(item.ref)}>
                      <Check size={16} />
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={!!vincularItem} onClose={() => setVincularItem(null)} title="Vincular mídia a um exercício">
        {vincularItem && vincularItem.kind === 'PENDENCIA' && (
          <VincularMidiaForm item={vincularItem} onDone={() => setVincularItem(null)} />
        )}
      </Modal>
    </div>
  )
}

function VincularMidiaForm({ item, onDone }: { item: Extract<CentralItem, { kind: 'PENDENCIA' }>; onDone: () => void }) {
  const { data: exercicios } = useExerciciosAluno(item.aluno_id)
  const vincular = useVincularMidia()
  const [exId, setExId] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const ex = exercicios?.find((x) => x.exercicio_id === exId)
    if (!ex || !item.payload?.midia_id) return
    await vincular.mutateAsync({
      ref: item.ref, aluno_id: item.aluno_id, midia_id: item.payload.midia_id,
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
