import { useCallback, useEffect, useState } from 'react'
import { getCurrentUser, signIn as amplifySignIn, signOut as amplifySignOut } from 'aws-amplify/auth'
import { resetTokenCache } from '../api/client'

interface DivulgadorUser {
  username: string
}

export function useDivulgadorAuth() {
  const [user, setUser] = useState<DivulgadorUser | null>(null)
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
