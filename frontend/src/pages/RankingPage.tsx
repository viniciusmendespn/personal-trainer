import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Medal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { feedGlobalApi, type RankingPersonalItem } from '../api/feedGlobal'
import { Spinner, EmptyState } from '../components/ui'
import { RankingRulesInfo } from '../components/gamificacao/RankingRulesInfo'

type Periodo = 'semana' | 'mes' | 'geral'

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'geral', label: 'Geral' },
]

const MEDAL_STYLE: Record<number, { ring: string; text: string; bg: string }> = {
  1: { ring: 'ring-yellow-400/40', text: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  2: { ring: 'ring-slate-400/40', text: 'text-slate-400', bg: 'bg-slate-400/10' },
  3: { ring: 'ring-amber-600/40', text: 'text-amber-600', bg: 'bg-amber-600/10' },
}

function pontosPeriodo(r: RankingPersonalItem, periodo: Periodo): number {
  if (periodo === 'semana') return r.semana_atual ?? 0
  if (periodo === 'mes') return r.mes_atual ?? 0
  return r.total_pontos ?? 0
}

export function RankingPage() {
  const [periodo, setPeriodo] = useState<Periodo>('geral')
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['ranking-personal'],
    queryFn: feedGlobalApi.ranking,
  })

  const ranking = [...(data ?? [])].sort(
    (a, b) => pontosPeriodo(b, periodo) - pontosPeriodo(a, periodo),
  )

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text">Ranking de Alunos</h1>
          <p className="text-sm text-text-muted mt-0.5">Pontos acumulados por atividades</p>
        </div>
        <RankingRulesInfo />
      </div>

      {/* Seletor de período */}
      <div className="flex bg-surface-elevated rounded-xl p-1 gap-1 border border-border">
        {PERIODOS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriodo(key)}
            className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-colors ${
              periodo === key
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center pt-12"><Spinner /></div>
      ) : !ranking.length ? (
        <EmptyState
          icon={<Trophy size={32} />}
          title="Nenhum aluno no ranking ainda"
          description="Quando seus alunos registrarem treinos, eles aparecerão aqui."
        />
      ) : (
        <div className="space-y-2">
          {ranking.map((aluno, idx) => {
            const pos = idx + 1
            const pts = pontosPeriodo(aluno, periodo)
            const medal = MEDAL_STYLE[pos]

            return (
              <button
                key={aluno.aluno_id}
                onClick={() => navigate(`/alunos/${aluno.aluno_id}`)}
                className={`w-full flex items-center gap-4 rounded-2xl px-4 py-3 border transition-colors text-left hover:border-accent/40 ${
                  medal
                    ? `bg-surface-elevated ${medal.ring} ring-1`
                    : 'bg-surface-elevated border-border'
                }`}
              >
                {/* Posição */}
                <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${medal ? medal.bg : 'bg-white/5'}`}>
                  {pos <= 3 ? (
                    <Medal size={18} className={medal?.text ?? 'text-text-muted'} />
                  ) : (
                    <span className="text-sm font-bold text-text-muted">#{pos}</span>
                  )}
                </div>

                {/* Nome */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${medal ? medal.text : 'text-text-primary'}`}>
                    {pos === 1 && '🏆 '}{aluno.nome}
                  </p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-xs text-text-muted">
                      Semana: <span className="text-text-secondary font-medium">{aluno.semana_atual ?? 0}</span>
                    </span>
                    <span className="text-xs text-text-muted">
                      Mês: <span className="text-text-secondary font-medium">{aluno.mes_atual ?? 0}</span>
                    </span>
                    <span className="text-xs text-text-muted">
                      Total: <span className="text-text-secondary font-medium">{aluno.total_pontos ?? 0}</span>
                    </span>
                  </div>
                </div>

                {/* Pontos do período */}
                <div className="shrink-0 text-right">
                  <p className={`text-lg font-bold ${medal ? medal.text : 'text-text-secondary'}`}>
                    {pts}
                  </p>
                  <p className="text-xs text-text-muted">pts</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
