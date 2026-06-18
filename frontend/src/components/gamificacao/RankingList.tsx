import { Trophy, Medal } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { alunoApi } from '../../api/alunoApp'
import { Spinner, EmptyState } from '../ui'

const POSICAO_STYLE: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-slate-300',
  3: 'text-amber-600',
}

export function RankingList() {
  const { data: ranking, isLoading } = useQuery({
    queryKey: ['aluno-ranking'],
    queryFn: alunoApi.ranking,
  })

  if (isLoading) return <div className="flex justify-center pt-8"><Spinner /></div>
  if (!ranking?.length) {
    return (
      <EmptyState
        icon={<Trophy size={32} />}
        title="Ranking em branco"
        description="Registre treinos para acumular pontos e aparecer aqui."
      />
    )
  }

  return (
    <div className="space-y-2">
      {ranking.map((r) => (
        <div
          key={r.aluno_id}
          className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-colors ${
            r.eu
              ? 'bg-energy/10 border-energy/30'
              : 'bg-surface-elevated border-border'
          }`}
        >
          <span className={`w-6 text-center font-bold text-sm ${POSICAO_STYLE[r.posicao] ?? 'text-text-muted'}`}>
            {r.posicao <= 3 ? <Medal size={16} className="inline" /> : `#${r.posicao}`}
          </span>
          <span className={`flex-1 text-sm font-medium ${r.eu ? 'text-energy' : 'text-text-primary'}`}>
            {r.nome}{r.eu ? ' (você)' : ''}
          </span>
          <span className="text-sm font-semibold text-text-secondary">
            {r.total_pontos ?? 0} pts
          </span>
        </div>
      ))}
    </div>
  )
}
