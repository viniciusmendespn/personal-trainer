import { Trophy, Zap } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { alunoApi } from '../../api/alunoApp'

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
  const minhaPosicao = ranking?.find((r) => r.eu)?.posicao
  const totalAlunos = ranking?.length ?? 0

  return (
    <button
      onClick={onVerRanking}
      className="w-full flex items-center gap-3 bg-surface-elevated rounded-2xl px-4 py-3 border border-border hover:border-energy/40 transition-colors text-left"
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-energy/10">
        <Trophy size={20} className="text-energy" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">
          {total} <span className="font-normal text-text-muted">pontos</span>
        </p>
        {minhaPosicao != null && (
          <p className="text-xs text-text-muted">
            #{minhaPosicao} de {totalAlunos} aluno{totalAlunos !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      <Zap size={14} className="text-energy shrink-0" />
    </button>
  )
}
