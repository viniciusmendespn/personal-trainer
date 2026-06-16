import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Spinner } from '../components/ui'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
