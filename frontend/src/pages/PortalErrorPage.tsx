import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export function PortalErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()

  const is404 = isRouteErrorResponse(error) && error.status === 404
  const title = is404 ? 'Página não encontrada' : 'Algo deu errado'
  const description = is404
    ? 'A página que você tentou acessar não existe.'
    : 'Ocorreu um erro inesperado. Tente recarregar ou volte ao início.'

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-4">
      <div className="max-w-sm w-full bg-surface-elevated border border-border rounded-xl p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-400" />
        </div>

        <div className="space-y-1">
          <h2 className="text-text font-semibold text-lg">{title}</h2>
          <p className="text-text-secondary text-sm">{description}</p>
        </div>

        <div className="flex gap-2 w-full pt-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-white/5 text-sm transition-colors"
          >
            Início
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={14} />
            Recarregar
          </button>
        </div>

        {import.meta.env.DEV && error instanceof Error && (
          <details className="w-full text-left bg-red-500/5 border border-red-500/20 rounded-lg p-3">
            <summary className="cursor-pointer text-xs font-medium text-red-400 select-none">
              Detalhes (dev)
            </summary>
            <pre className="mt-2 text-[11px] text-red-300 whitespace-pre-wrap break-all">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
