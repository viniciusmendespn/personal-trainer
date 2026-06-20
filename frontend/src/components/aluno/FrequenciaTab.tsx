import { useQuery } from '@tanstack/react-query'
import { Flame, Trophy, TrendingUp, Dumbbell } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { evolucaoApi } from '../../api/evolucao'
import { badgesApi } from '../../api/badges'
import { Card, StatCard, Spinner, EmptyState } from '../ui'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: 'var(--color-text)',
  fontSize: 12,
}
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 11 }

export function FrequenciaTab({ alunoId }: { alunoId: string }) {
  const resumo = useQuery({
    queryKey: ['aluno-resumo-portal', alunoId],
    queryFn: () => evolucaoApi.resumo(alunoId),
    enabled: !!alunoId,
  })
  const badges = useQuery({
    queryKey: ['aluno-badges', alunoId],
    queryFn: () => badgesApi.list(alunoId),
    enabled: !!alunoId,
  })

  if (resumo.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>

  const r = resumo.data
  const streak = r?.streak_atual ?? 0
  const streakMax = r?.streak_maximo ?? 0
  const mult = r?.multiplicador_atual ?? 1.0
  const media = r?.media_sessoes_semana
  const semanas = (r?.semanas ?? []).slice(-16).map((w) => ({
    semana: 'Sem ' + w.semana.replace(/^\d+-W/, ''),
    sessoes: w.sessoes,
    volume: w.volume,
  }))

  const unlockedBadges = (badges.data ?? []).filter((b) => b.unlocked)

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total de sessões" value={r?.total_sessoes ?? 0} tone="accent" />
        <StatCard label="Média semanal" value={media != null ? `${media.toFixed(1)}/sem` : '—'} tone="success" />
        <div className="bg-surface-elevated rounded-2xl p-3 border border-border">
          <p className="text-xs text-text-muted mb-0.5 flex items-center gap-1">
            <Flame size={12} className="text-orange-400" /> Sequência atual
          </p>
          <p className="text-xl font-bold text-text">{streak} <span className="text-sm font-normal text-text-muted">sem{streak !== 1 ? 'anas' : 'ana'}</span></p>
          {mult > 1.0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-energy/15 text-energy mt-1 inline-block">×{mult.toFixed(1)}</span>
          )}
        </div>
        <div className="bg-surface-elevated rounded-2xl p-3 border border-border">
          <p className="text-xs text-text-muted mb-0.5 flex items-center gap-1">
            <Trophy size={12} className="text-energy" /> Melhor sequência
          </p>
          <p className="text-xl font-bold text-text">{streakMax} <span className="text-sm font-normal text-text-muted">sem{streakMax !== 1 ? 'anas' : 'ana'}</span></p>
        </div>
      </div>

      {/* Gráfico de sessões por semana */}
      {semanas.length > 1 ? (
        <Card variant="elevated">
          <p className="text-sm text-text-secondary mb-3 flex items-center gap-1"><TrendingUp size={14} /> Sessões por semana (últimas 16)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={semanas} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="semana" tick={axisTick} stroke="var(--color-border-strong)" />
              <YAxis tick={axisTick} stroke="var(--color-border-strong)" allowDecimals={false} />
              <Tooltip contentStyle={chartTip} formatter={(v: number) => [v, 'Sessões']} />
              <Bar dataKey="sessoes" fill="var(--color-energy)" radius={[4, 4, 0, 0]} name="Sessões" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <EmptyState icon={<Dumbbell />} title="Sem histórico suficiente" description="Finalize ao menos 2 semanas de treino para ver o gráfico." />
      )}

      {/* Badges */}
      <Card variant="elevated">
        <p className="text-sm text-text-secondary mb-3 flex items-center gap-1"><Trophy size={14} /> Conquistas</p>
        {badges.isLoading ? (
          <div className="flex justify-center py-3"><Spinner /></div>
        ) : !unlockedBadges.length ? (
          <p className="text-xs text-text-muted">Nenhuma conquista desbloqueada ainda.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {unlockedBadges.map((b) => (
              <div key={b.tipo} className="flex flex-col items-center gap-1 p-2 bg-surface rounded-xl border border-border">
                <span className="text-2xl">{b.emoji}</span>
                <p className="text-[11px] font-medium text-center leading-tight">{b.titulo}</p>
                {b.unlocked_at && (
                  <p className="text-[9px] text-text-muted">{new Date(b.unlocked_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
