import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { resendSignUpCode } from 'aws-amplify/auth'
import { useAuth } from './AuthProvider'
import { cognitoErrorPtBr } from './cognitoErrors'
import { Button, Input, ErrorText, Card } from '../components/ui'
import { AuthBackground } from './AuthBackground'

export function LoginPage() {
  const { user, signIn, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const homeRoute = (adminEmail: string) =>
    adminEmail === 'admin@coachpilot.com.br' ? '/admin' : '/dashboard'

  if (user) {
    navigate(isAdmin ? '/admin' : '/dashboard', { replace: true })
    return null
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setUnconfirmed(false)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate(homeRoute(email), { replace: true })
    } catch (err) {
      if ((err as { name?: string })?.name === 'UserNotConfirmedException') {
        setUnconfirmed(true)
      }
      setError(cognitoErrorPtBr(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleResendConfirmation() {
    setResending(true)
    try {
      await resendSignUpCode({ username: email })
      navigate('/signup', { state: { email, step: 'confirm' } })
    } catch (err) {
      setError(cognitoErrorPtBr(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthBackground>
      <Card variant="glass" className="w-full max-w-sm p-6 shadow-[var(--shadow-card)]">
        <form onSubmit={handle} className="space-y-4">
          <div className="text-center mb-2">
            <div className="flex items-center justify-center mb-1">
              <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" style={{ height: 120, width: 'auto' }} />
            </div>
            <p className="text-sm text-text-secondary">Acesse sua conta</p>
          </div>
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-secondary">Senha</span>
              <Link to="/forgot-password" className="text-xs text-accent-hover hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <ErrorText>{error}</ErrorText>
          {unconfirmed && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResendConfirmation}
              disabled={resending}
            >
              {resending ? 'Enviando…' : 'Reenviar código de confirmação'}
            </Button>
          )}
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
    </AuthBackground>
  )
}
