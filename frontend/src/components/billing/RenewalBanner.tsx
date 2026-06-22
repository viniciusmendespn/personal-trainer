import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { usePlanoStatus } from '../../hooks/usePlano'

export function RenewalBanner() {
  const { data } = usePlanoStatus()
  const navigate = useNavigate()

  if (!data || data.plano !== 'GESTAO_PRO') return null
  if (data.dias_restantes == null || data.dias_restantes > 7) return null

  const venceuJa = data.status === 'EXPIRADO'

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-xs shrink-0">
      <span className="flex items-center gap-1.5">
        <AlertTriangle size={14} className="shrink-0" />
        {venceuJa
          ? 'Sua assinatura Gestão Pro venceu. Renove para voltar a ter alunos ilimitados.'
          : `Sua assinatura Gestão Pro vence em ${data.dias_restantes} dia${data.dias_restantes === 1 ? '' : 's'}.`}
      </span>
      <button
        onClick={() => navigate('/plano')}
        className="shrink-0 px-2.5 py-1 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 transition-colors font-medium"
      >
        Renovar
      </button>
    </div>
  )
}
