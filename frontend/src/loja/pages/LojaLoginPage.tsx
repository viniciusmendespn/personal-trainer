import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { cognitoErrorPtBr } from '../../auth/cognitoErrors'
import { Button, Card, ErrorText, Input } from '../../components/ui'
import { useLojaAuthContext } from '../LojaApp'

export function LojaLoginPage() {
  const { user, loading, signIn } = useLojaAuthContext()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate(next, { replace: true })
  }, [loading, user, next, navigate])

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(cognitoErrorPtBr(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex justify-center px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.18), transparent 70%)', filter: 'blur(24px)' }}
      />
      <Card variant="glass" className="relative w-full max-w-sm p-6">
        <form onSubmit={handle} className="space-y-4">
          <div className="text-center mb-2">
            <div className="flex flex-col items-center gap-1.5 mb-2">
              <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" className="h-16 w-auto" />
              <span className="loja-gradient rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                Loja
              </span>
            </div>
            <p className="text-sm text-text-secondary">
              Entre com sua conta CoachPilot para comprar
            </p>
          </div>
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="relative">
            <Input
              label="Senha"
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
              className="absolute right-3 bottom-2.5 text-text-muted hover:text-text"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
          <p className="text-center text-xs text-text-secondary">
            Ainda não tem conta?{' '}
            <a href="https://coachpilot.com.br/signup" className="text-accent-hover hover:underline">
              Crie grátis no CoachPilot
            </a>
          </p>
          <p className="text-center text-xs text-text-muted">
            <a href="https://coachpilot.com.br/forgot-password" className="hover:underline">
              Esqueceu a senha?
            </a>
          </p>
        </form>
      </Card>
    </div>
  )
}
