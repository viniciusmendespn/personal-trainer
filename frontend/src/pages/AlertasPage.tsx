import { AlertTriangle, Check, Clock } from 'lucide-react'
import { useAlertas, useResolveAlerta, usePendencias, useResolvePendencia } from '../hooks/useAlertas'
import { Card, Spinner, Button } from '../components/ui'

export function AlertasPage() {
  const alertas = useAlertas()
  const resolveA = useResolveAlerta()
  const pend = usePendencias()
  const resolveP = useResolvePendencia()

  const abertos = (alertas.data ?? []).filter((a) => a.status !== 'RESOLVIDO')

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle size={20} className="text-red-400" /> Alertas de dor
        </h2>
        {alertas.isLoading ? (
          <Spinner />
        ) : !abertos.length ? (
          <p className="text-slate-500 text-sm">Nenhum alerta aberto.</p>
        ) : (
          <div className="space-y-2">
            {abertos.map((a) => (
              <Card key={a.ref} className="flex items-center justify-between">
                <div>
                  <p className="text-sm">{a.descricao}</p>
                  <p className="text-xs text-slate-500">
                    {a.exercicio_nome ? `${a.exercicio_nome} · ` : ''}
                    {new Date(a.data_hora).toLocaleString('pt-BR')}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => resolveA.mutate(a.ref)}>
                  <Check size={16} />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock size={20} className="text-amber-400" /> Pendências
        </h2>
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
                <Button variant="ghost" onClick={() => resolveP.mutate(p.ref)}>
                  <Check size={16} />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
