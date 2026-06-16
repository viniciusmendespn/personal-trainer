import { Bell, Check, Clock, AlertTriangle, CalendarClock } from 'lucide-react'
import {
  useNotificacoes, useMarkRead, useMarkAllRead, usePendencias, useResolvePendencia,
} from '../hooks/useNotificacoes'
import { Card, Spinner, Button } from '../components/ui'

const ICON: Record<string, React.ReactNode> = {
  DOR: <AlertTriangle size={16} className="text-red-400" />,
  TREINO_FIM: <CalendarClock size={16} className="text-amber-400" />,
  PENDENCIA: <Clock size={16} className="text-amber-400" />,
}

export function NotificacoesPage() {
  const notifs = useNotificacoes()
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const pend = usePendencias()
  const resolveP = useResolvePendencia()

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Bell size={20} className="text-emerald-400" /> Notificações</h2>
          <Button variant="ghost" onClick={() => markAll.mutate()}>Marcar todas como lidas</Button>
        </div>
        {notifs.isLoading ? (
          <Spinner />
        ) : !notifs.data?.length ? (
          <p className="text-slate-500 text-sm">Nenhuma notificação.</p>
        ) : (
          <div className="space-y-2">
            {notifs.data.map((n) => (
              <Card key={n.ref} className={`flex items-start justify-between ${n.lida ? 'opacity-60' : 'border-emerald-700/30'}`}>
                <div className="flex gap-2">
                  <div className="mt-0.5">{ICON[n.tipo] ?? <Bell size={16} className="text-slate-400" />}</div>
                  <div>
                    <p className="text-sm font-medium">{n.titulo}</p>
                    <p className="text-xs text-slate-400">{n.mensagem}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{new Date(n.data_hora).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                {!n.lida && (
                  <button onClick={() => markRead.mutate(n.ref)} className="text-slate-500 hover:text-emerald-400" title="Marcar como lida">
                    <Check size={16} />
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Clock size={20} className="text-amber-400" /> Pendências</h2>
        {pend.isLoading ? (
          <Spinner />
        ) : !pend.data?.length ? (
          <p className="text-slate-500 text-sm">Nenhuma pendência.</p>
        ) : (
          <div className="space-y-2">
            {pend.data.map((p) => (
              <Card key={p.ref} className="flex items-center justify-between">
                <div>
                  <p className="text-sm">{p.tipo} — {p.motivo}</p>
                  <p className="text-xs text-slate-500">{new Date(p.data_hora).toLocaleString('pt-BR')}</p>
                </div>
                <Button variant="ghost" onClick={() => resolveP.mutate(p.ref)}><Check size={16} /></Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
