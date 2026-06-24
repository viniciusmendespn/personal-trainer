import { createContext, useContext, useEffect, useState } from 'react'
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchUserAttributes,
} from 'aws-amplify/auth'
import { useQueryClient } from '@tanstack/react-query'
import { setImpersonationToken, resetTokenCache } from '../api/client'

const ADMIN_EMAIL = 'admin@coachpilot.com.br'

interface AuthUser {
  userId: string
  username: string
  email?: string
  name?: string
}

interface ImpersonatingState {
  personalId: string
  name: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAdmin: boolean
  impersonating: ImpersonatingState | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  impersonate: (personalId: string, name: string, token: string) => void
  stopImpersonating: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [impersonating, setImpersonating] = useState<ImpersonatingState | null>(null)
  const queryClient = useQueryClient()

  async function load() {
    try {
      const u = await getCurrentUser()
      const attrs = (await fetchUserAttributes().catch(() => ({}))) as Record<string, string>
      setUser({ userId: u.userId, username: u.username, email: attrs.email, name: attrs.name })
      const saved = sessionStorage.getItem('pt:impersonation')
      if (saved) {
        const { personalId, name, token } = JSON.parse(saved)
        setImpersonationToken(token)
        setImpersonating({ personalId, name })
      }
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    load().finally(() => setIsLoading(false))
  }, [])

  async function signIn(email: string, password: string) {
    resetTokenCache()
    queryClient.clear()
    const result = await amplifySignIn({ username: email, password })
    if (result.isSignedIn) await load()
  }

  async function signOut() {
    sessionStorage.removeItem('pt:impersonation')
    setImpersonationToken(null)
    setImpersonating(null)
    await amplifySignOut()
    resetTokenCache()
    queryClient.clear()
    setUser(null)
  }

  function impersonate(personalId: string, name: string, token: string) {
    sessionStorage.setItem('pt:impersonation', JSON.stringify({ personalId, name, token }))
    setImpersonationToken(token)
    setImpersonating({ personalId, name })
    queryClient.clear()
  }

  function stopImpersonating() {
    sessionStorage.removeItem('pt:impersonation')
    setImpersonationToken(null)
    setImpersonating(null)
    queryClient.clear()
  }

  const isAdmin = user?.email === ADMIN_EMAIL

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAdmin, impersonating, signIn, signOut, refresh: load, impersonate, stopImpersonating }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve estar dentro de AuthProvider')
  return ctx
}
