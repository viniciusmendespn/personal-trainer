import { useNavigate } from 'react-router-dom'
import { Gift } from 'lucide-react'
import { usePlanoStatus } from '../../hooks/usePlano'

export function FinPilotBanner() {
  const { data } = usePlanoStatus()
  const navigate = useNavigate()

  if (!data || data.plano !== 'GESTAO_PRO' || data.status !== 'ATIVO') return null

  return (
    <div data-theme="dark" className="flex items-center justify-between gap-3 px-4 py-2 bg-teal-500/10 border-b border-teal-500/20 text-teal-300 text-xs shrink-0">
      <span className="flex items-center gap-1.5">
        <Gift size={14} className="shrink-0" />
        <span>
          <span className="font-semibold">Benefício Gestão Pro:</span> a cada mês pago você recebe um código para{' '}
          <span className="font-semibold">1 mês grátis no FinPilot</span>{' '}
          — planilha inteligente com IA para controle financeiro pessoal.
        </span>
      </span>
      <button
        onClick={() => navigate('/plano')}
        className="shrink-0 px-2.5 py-1 rounded bg-teal-500/20 hover:bg-teal-500/35 text-teal-200 transition-colors font-medium whitespace-nowrap"
      >
        Ver código
      </button>
    </div>
  )
}
