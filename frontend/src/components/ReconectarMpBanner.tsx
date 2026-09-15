import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { financeiroApi } from '../api/financeiro'

/**
 * Aviso de que a conexão com o Mercado Pago caiu (expirou, foi revogada, ou o personal
 * ainda usava o Access Token colado à mão, de antes do OAuth).
 *
 * Deriva do mesmo `['mp-config']` que a tela de Pagamentos, então some sozinho no
 * instante em que o personal reconecta — não há estado próprio para sincronizar.
 *
 * Diferente do ConectarIaBanner, NÃO tem "dispensar": enquanto isso aparece, nenhum
 * aluno consegue pagar por Pix. Pendência não se esconde, se resolve.
 */
export function ReconectarMpBanner() {
  const { data } = useQuery({
    queryKey: ['mp-config'],
    queryFn: financeiroApi.getMpConfig,
    staleTime: 5 * 60_000,
  })

  if (data?.status !== 'REQUER_RECONEXAO') return null

  return (
    <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="text-danger shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-display font-semibold text-text text-sm">
            Reconecte seu Mercado Pago
          </p>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            A conexão expirou ou foi revogada, e por isso seus alunos não estão conseguindo
            pagar por Pix. Reconectar leva um clique — as cobranças em aberto continuam valendo.
          </p>
          <Link
            to="/config?tab=pagamentos"
            className="inline-block mt-3 px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Reconectar agora
          </Link>
        </div>
      </div>
    </div>
  )
}
