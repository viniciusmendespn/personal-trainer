import { useState } from 'react'
import { Trophy, Medal } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { alunoApi, type RankingItem } from '../../api/alunoApp'
import { Avatar, Spinner, EmptyState } from '../ui'
import { RankingRulesInfo } from './RankingRulesInfo'

type Periodo = 'semana' | 'mes' | 'geral'

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'geral', label: 'Geral' },
]

const POSICAO_STYLE: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-slate-400',
  3: 'text-amber-600',
}

function pontosPeriodo(r: RankingItem, periodo: Periodo): number {
  if (periodo === 'semana') return r.semana_atual ?? 0
  if (periodo === 'mes') return r.mes_atual ?? 0
  return r.total_pontos ?? 0
}

function rankPorPeriodo(ranking: RankingItem[], periodo: Periodo): (RankingItem & { posicao_periodo: number })[] {
  const sorted = [...ranking].sort((a, b) => pontosPeriodo(b, periodo) - pontosPeriodo(a, periodo))
  return sorted.map((r, i) => ({ ...r, posicao_periodo: i + 1 }))
}

export function RankingList() {
  const [periodo, setPeriodo] = useState<Periodo>('semana')
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

  const ranked = rankPorPeriodo(ranking, periodo)

  return (
    <div className="space-y-3">
      {/* Seletor de período */}
      <div className="flex items-center gap-2">
        <div className="flex bg-surface rounded-xl p-1 gap-1 flex-1">
          {PERIODOS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriodo(key)}
              className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${
                periodo === key
                  ? 'bg-energy text-white'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <RankingRulesInfo />
      </div>

      {/* Lista */}
      {ranked.map((r) => {
        const pts = pontosPeriodo(r, periodo)
        return (
          <div
            key={r.aluno_id}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-colors ${
              r.eu
                ? 'bg-energy/10 border-energy/30'
                : 'bg-surface-elevated border-border'
            }`}
          >
            <span className={`w-6 text-center font-bold text-sm shrink-0 ${POSICAO_STYLE[r.posicao_periodo] ?? 'text-text-muted'}`}>
              {r.posicao_periodo <= 3 ? <Medal size={16} className="inline" /> : `#${r.posicao_periodo}`}
            </span>
            <Avatar name={r.nome} imageUrl={r.foto_url} size="sm" />
            <span className={`flex-1 text-sm font-medium truncate ${r.eu ? 'text-energy' : 'text-text-primary'}`}>
              {r.nome}{r.eu ? ' (você)' : ''}
            </span>
            <span className="text-sm font-semibold text-text-secondary">
              {pts} pts
            </span>
          </div>
        )
      })}
    </div>
  )
}
