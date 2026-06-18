import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Button, Input, ErrorText, Card } from '../components/ui'
import { AppLogo } from '../components/AppLogo'

export function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    navigate('/alunos', { replace: true })
    return null
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/alunos', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card variant="glass" className="w-full max-w-sm p-6 shadow-[var(--shadow-card)]">
        <form onSubmit={handle} className="space-y-4">
          <div className="text-center mb-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <AppLogo size={32} />
              <h1 className="font-display text-2xl font-bold text-text">CoachPilot</h1>
            </div>
            <p className="text-sm text-text-secondary">Acesse sua conta</p>
          </div>
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
          <p className="text-center text-sm text-text-secondary">
            Não tem conta?{' '}
            <Link to="/signup" className="text-accent-hover hover:underline">
              Cadastre-se
            </Link>
          </p>
        </form>
      </Card>
    </div>
  )
}
