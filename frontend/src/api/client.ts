import axios from 'axios'
import { fetchAuthSession } from 'aws-amplify/auth'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 30_000,
})

// Cache do idToken em memória — evita fetchAuthSession() a cada request (ARCHITECTURE §7.2)
let _token: string | null = null
let _exp = 0

// Token de impersonação emitido por /v1/admin/impersonate — enviado em X-Impersonate
let _impersonationToken: string | null = null

export function setImpersonationToken(token: string | null) {
  _impersonationToken = token
}

export function isImpersonating(): boolean {
  return _impersonationToken !== null
}

async function getToken(): Promise<string | null> {
  if (_token && Date.now() < _exp - 120_000) return _token
  try {
    const session = await fetchAuthSession()
    const t = session.tokens?.idToken
    if (!t) return null
    _token = t.toString()
    _exp = (t.payload.exp as number) * 1000
    return _token
  } catch {
    return null
  }
}

api.interceptors.request.use(async (config) => {
  const token = await getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (_impersonationToken) config.headers['X-Impersonate'] = _impersonationToken
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      _token = null
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)
