import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarX, CheckCircle2, DollarSign, Dumbbell } from 'lucide-react'
import { usePendenciasAluno } from '../../hooks/usePendencias'
import type { Pendencia, PendenciaTipo } from '../../api/pendencias'
import { Button, Card, EmptyState, Spinner } from '../ui'

const TIPO_ICON: Record<PendenciaTipo, React.ReactNode> = {
  SEM_TREINO_VIGENTE: <Dumbbell size={18} />,
  SEM_TREINAR: <CalendarX size={18} />,
  PAGAMENTO_ATRASADO: <DollarSign size={18} />,
}

const ACAO_LABEL: Record<PendenciaTipo, string> = {
  SEM_TREINO_VIGENTE: 'Ver treinos',
  SEM_TREINAR: 'Ver histórico',
  PAGAMENTO_ATRASADO: 'Ver financeiro',
}

/** Alta = vermelho, média = âmbar. Mesmo par de tons dos alertas do resto do portal. */
function tomDe(severidade: Pendencia['severidade']) {
  return severidade === 'alta'
    ? { borda: 'border-danger/50 bg-danger/10', texto: 'text-danger' }
    : { borda: 'border-warning/50 bg-warning/10', texto: 'text-warning' }
}

export function PendenciasTab({ alunoId }: { alunoId: string }) {
  const { data: pendencias, isLoading } = usePendenciasAluno(alunoId)
  const [, setSearchParams] = useSearchParams()

  if (isLoading) return <Spinner />

  if (!pendencias?.length) {
    return (
      <EmptyState
        icon={<CheckCircle2 />}
        title="Nenhuma pendência"
        description="Este aluno tem treino vigente, está treinando e não tem cobrança em atraso."
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        Situações que pedem sua atenção. Somem sozinhas assim que a causa é resolvida.
      </p>
      {pendencias.map((p) => {
        const tom = tomDe(p.severidade)
        return (
          <Card key={p.tipo} className={`flex items-start gap-3 border ${tom.borda}`}>
            <span className={`shrink-0 mt-0.5 ${tom.texto}`}>{TIPO_ICON[p.tipo]}</span>
            <div className="min-w-0 flex-1">
              <p className={`font-medium ${tom.texto}`}>{p.titulo}</p>
              {p.detalhe && <p className="text-sm text-text-secondary mt-0.5">{p.detalhe}</p>}
            </div>
            {p.tab && (
              <Button
                variant="ghost"
                className="shrink-0"
                onClick={() => setSearchParams({ tab: p.tab as string }, { replace: true })}
              >
                {ACAO_LABEL[p.tipo]}
              </Button>
            )}
          </Card>
        )
      })}
    </div>
  )
}

/** Marca discreta no canto superior direito do card da listagem de alunos.
 *  Absoluta de propósito: fora do fluxo, não disputa largura com o nome (que trunca).
 *  O contador só aparece com 2+ — no caso comum fica só o triângulo. O padding é área
 *  de toque (o ícone de 11px sozinho seria pequeno demais para o dedo). */
export function PendenciaBadge({ pendencias, onClick }: {
  pendencias: { severidade: string; titulo: string }[]
  onClick: (e: React.MouseEvent) => void
}) {
  if (!pendencias.length) return null
  const alta = pendencias.some((p) => p.severidade === 'alta')
  const descricao = pendencias.map((p) => p.titulo).join(' • ')
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e as unknown as React.MouseEvent) }}
      title={`${descricao} — clique para ver`}
      aria-label={`${pendencias.length} pendência${pendencias.length > 1 ? 's' : ''}: ${descricao}`}
      className={`absolute top-1 right-1 z-10 inline-flex items-center gap-px p-1.5 leading-none
        cursor-pointer opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity ${
        alta ? 'text-danger' : 'text-warning'
      }`}
    >
      <AlertTriangle size={11} />
      {pendencias.length > 1 && <span className="text-[9px] font-medium">{pendencias.length}</span>}
    </span>
  )
}
