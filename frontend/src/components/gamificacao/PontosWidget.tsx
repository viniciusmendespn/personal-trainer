import { Trophy, Zap, Flame } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { alunoApi } from '../../api/alunoApp'
import { RankingRulesInfo } from './RankingRulesInfo'

interface Props {
  onVerRanking?: () => void
}

export function PontosWidget({ onVerRanking }: Props) {
  const { data: pontos } = useQuery({
    queryKey: ['aluno-pontos'],
    queryFn: alunoApi.pontos,
  })
  const { data: ranking } = useQuery({
    queryKey: ['aluno-ranking'],
    queryFn: alunoApi.ranking,
  })

  const total = pontos?.total ?? 0
  const semana = pontos?.semana_atual ?? 0
  const mes = pontos?.mes_atual ?? 0
  const streak = pontos?.streak_atual ?? 0
  const mult = pontos?.multiplicador_atual ?? 1.0
  const minhaPosicao = Array.isArray(ranking) ? ranking.find((r) => r.eu)?.posicao : undefined
  const totalAlunos = ranking?.length ?? 0

  return (
    <div className="w-full bg-surface-elevated rounded-2xl px-4 py-3 border border-border">
      <div className="flex items-center gap-3">
        <button
          onClick={onVerRanking}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-energy/10 shrink-0 hover:bg-energy/20 transition-colors"
        >
          <Trophy size={20} className="text-energy" />
        </button>
        <button onClick={onVerRanking} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-text-primary">
            {total} <span className="font-normal text-text-muted">pts total</span>
          </p>
          {minhaPosicao != null && (
            <p className="text-xs text-text-muted">
              #{minhaPosicao} de {totalAlunos} aluno{totalAlunos !== 1 ? 's' : ''}
            </p>
          )}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <RankingRulesInfo />
          <Zap size={14} className="text-energy" />
        </div>
      </div>

      {streak > 0 && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
          <Flame size={14} className="text-orange-400 shrink-0" />
          <span className="text-xs text-text-muted">
            Sequência: <span className="font-semibold text-text">{streak} sem{streak !== 1 ? 'anas' : 'ana'}</span>
          </span>
          {mult > 1.0 && (
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-energy/15 text-energy">
              ×{mult.toFixed(1)}
            </span>
          )}
        </div>
      )}

      {(semana > 0 || mes > 0) && (
        <div className="flex gap-4 mt-2 pt-2 border-t border-border">
          <span className="text-xs text-text-muted">
            Semana: <span className="font-semibold text-energy">{semana}</span>
          </span>
          <span className="text-xs text-text-muted">
            Mês: <span className="font-semibold text-text-secondary">{mes}</span>
          </span>
        </div>
      )}
    </div>
  )
}
