import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users, AlertTriangle, Clock, MessageCircle } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { wapiApi } from '../api/wapi'
import { Card, Spinner } from '../components/ui'

function Stat({ icon, label, value, color = 'text-slate-400' }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <Card className="flex items-center gap-3">
      <div className={color}>{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  )
}

export function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const status = useQuery({ queryKey: ['wapi-status'], queryFn: wapiApi.status, retry: false })

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-6">Visão geral</h2>

      {status.data && !status.data.connected && (
        <Card className="mb-6 border-amber-700/40 bg-amber-950/20">
          <div className="flex items-center gap-2 text-amber-300 text-sm">
            <MessageCircle size={18} />
            <span>
              Seu WhatsApp não está conectado.{' '}
              <Link to="/config" className="underline font-medium">Conectar agora</Link> para ativar o assistente.
            </span>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<Users size={22} />} label="Alunos" value={data?.alunos ?? 0} color="text-emerald-400" />
          <Stat icon={<Users size={22} />} label="Ativos" value={data?.alunos_ativos ?? 0} color="text-emerald-400" />
          <Stat icon={<AlertTriangle size={22} />} label="Alertas abertos" value={data?.alertas_abertos ?? 0} color="text-red-400" />
          <Stat icon={<Clock size={22} />} label="Pendências" value={data?.pendencias ?? 0} color="text-amber-400" />
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Link to="/alunos" className="text-emerald-400 text-sm hover:underline">→ Gerenciar alunos</Link>
        <Link to="/alertas" className="text-emerald-400 text-sm hover:underline">→ Ver alertas</Link>
      </div>
    </div>
  )
}
