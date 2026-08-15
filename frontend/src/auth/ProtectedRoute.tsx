import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Spinner } from '../components/ui'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  if (!user) {
    // Preserva o destino em `next` (query, não state do router): o login faz navegação DURA
    // para recriar o contexto do Amplify, e o state do react-router não sobreviveria a ela.
    // Sem isso, quem chega deslogado em /oauth/consent?req=... perde a autorização em curso.
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{children}</>
}
