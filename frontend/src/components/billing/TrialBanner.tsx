import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { usePlanoStatus } from '../../hooks/usePlano'

export function TrialBanner() {
  const { data } = usePlanoStatus()
  const navigate = useNavigate()

  if (!data || data.plano !== 'TRIAL') return null

  const limit = data.alunos_limit ?? 3

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-accent/15 border-b border-accent/30 text-accent-hover text-xs shrink-0">
      <span className="flex items-center gap-1.5">
        <Sparkles size={14} className="shrink-0" />
        Plano Grátis — {data.alunos_count}/{limit} alunos. Assine o Gestão Pro e libere alunos ilimitados.
      </span>
      <button
        onClick={() => navigate('/plano')}
        className="shrink-0 px-2.5 py-1 rounded bg-accent/30 hover:bg-accent/50 text-accent-hover transition-colors font-medium"
      >
        Ver planos
      </button>
    </div>
  )
}
