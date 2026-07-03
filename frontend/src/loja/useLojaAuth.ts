import { useCallback, useEffect, useState } from 'react'
import { getCurrentUser, signIn as amplifySignIn, signOut as amplifySignOut } from 'aws-amplify/auth'
import { resetTokenCache } from '../api/client'

interface LojaUser {
  username: string
}

export function useLojaAuth() {
  const [user, setUser] = useState<LojaUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const u = await getCurrentUser()
      setUser({ username: u.username })
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signIn = useCallback(async (email: string, password: string) => {
    resetTokenCache()
    await amplifySignIn({ username: email, password })
    await refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    resetTokenCache()
    try { await amplifySignOut() } catch { /* ignora */ }
    setUser(null)
  }, [])

  return { user, loading, signIn, signOut, refresh }
}

/** Checagem pontual (fora de componente): há sessão Cognito ativa? */
export async function isLoggedIn(): Promise<boolean> {
  try {
    await getCurrentUser()
    return true
  } catch {
    return false
  }
}
