import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signUp, confirmSignUp, autoSignIn, resendSignUpCode } from 'aws-amplify/auth'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { cognitoErrorPtBr, passwordOk } from './cognitoErrors'
import { AuthStepIndicator } from './AuthStepIndicator'
import { PasswordChecklist } from './PasswordChecklist'
import { useResendCooldown } from './useResendCooldown'
import { SpamNotice } from './SpamNotice'
import { Button, Input, ErrorText, Card, useToast } from '../components/ui'
import { AuthBackground } from './AuthBackground'

type Step = 'email' | 'password' | 'confirm'
const STEP_LABELS = ['E-mail', 'Senha', 'Confirmação']
const STEP_INDEX: Record<Step, number> = { email: 0, password: 1, confirm: 2 }

export function SignUpPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { show } = useToast()
  const { cooldown, start: startCooldown } = useResendCooldown(60)

  const [step, setStep] = useState<Step>('email')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const state = location.state as { email?: string; step?: Step } | null
    if (state?.email && state.step === 'confirm') {
      setEmail(state.email)
      setStep('confirm')
    }
  }, [location.state])

  useEffect(() => {
    if (!alreadyRegistered) return
    const t = setTimeout(() => navigate('/login'), 1500)
    return () => clearTimeout(t)
  }, [alreadyRegistered, navigate])

  if (user) {
    navigate('/dashboard', { replace: true })
    return null
  }

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAlreadyRegistered(false)
    setLoading(true)
    try {
      await resendSignUpCode({ username: email })
      show('Encontramos um cadastro pendente — reenviamos o código de confirmação.', 'info')
      startCooldown()
      setStep('confirm')
    } catch (err) {
      const name = (err as { name?: string })?.name ?? ''
      const msg = err instanceof Error ? err.message : ''
      if (name === 'UserNotFoundException') {
        setStep('password')
      } else if (name === 'InvalidParameterException' || msg.includes('already confirmed') || msg.includes('CONFIRMED')) {
        setAlreadyRegistered(true)
        setError('Este e-mail já está cadastrado.')
      } else {
        setError(cognitoErrorPtBr(err))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAlreadyRegistered(false)
    if (!passwordOk(password)) {
      setError('A senha não atende aos requisitos mínimos.')
      return
    }
    if (password !== confirmPwd) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email, name }, autoSignIn: true },
      })
      setStep('confirm')
    } catch (err) {
      const name = (err as { name?: string })?.name ?? ''
      if (name === 'UsernameExistsException') {
        // Corrida rara: a conta foi criada entre o passo 1 e este submit. Resolve sozinho:
        // tenta reenviar o código — se funcionar, é pendente; se não, é confirmada.
        try {
          await resendSignUpCode({ username: email })
          show('Encontramos um cadastro pendente — reenviamos o código de confirmação.', 'info')
          setStep('confirm')
        } catch (resendErr) {
          setAlreadyRegistered(true)
          setError(cognitoErrorPtBr(resendErr))
        }
      } else {
        setError(cognitoErrorPtBr(err))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await confirmSignUp({ username: email, confirmationCode: code })
      await autoSignIn().catch(() => {})
      await refresh()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(cognitoErrorPtBr(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    setError('')
    setResending(true)
    try {
      await resendSignUpCode({ username: email })
      show('Novo código enviado para seu e-mail.', 'success')
      startCooldown()
    } catch (err) {
      setError(cognitoErrorPtBr(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthBackground>
      <Card variant="glass" className="w-full max-w-sm p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-center mb-4">
          <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" style={{ height: 90, width: 'auto' }} />
        </div>
        <AuthStepIndicator labels={STEP_LABELS} currentIndex={STEP_INDEX[step]} />

        {step === 'email' && (
          <form onSubmit={handleEmailContinue} className="space-y-4 mt-3">
            <h1 className="font-display text-xl font-bold text-text text-center">Criar conta</h1>
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <ErrorText>{error}</ErrorText>
            {alreadyRegistered && <p className="text-xs text-text-muted text-center">Redirecionando para o login…</p>}
            <Button type="submit" className="w-full" disabled={loading || alreadyRegistered}>
              {loading ? 'Verificando…' : 'Continuar'}
            </Button>
            <p className="text-center text-sm text-text-secondary">
              Já tem conta?{' '}
              <Link to="/login" className="text-accent-hover hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleSignUp} className="space-y-4 mt-3">
            <h1 className="font-display text-xl font-bold text-text text-center">Quase lá</h1>
            <div className="flex items-center justify-between -mt-2 bg-white/5 border border-border rounded-lg px-3 py-2">
              <span className="text-sm text-text-secondary truncate">{email}</span>
              <button type="button" onClick={() => setStep('email')} className="text-xs text-accent-hover hover:underline shrink-0 ml-2">
                alterar
              </button>
            </div>
            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
            <div>
              <span className="block text-xs font-medium text-text-secondary mb-1">Senha</span>
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
              <PasswordChecklist password={password} show={password.length > 0} />
            </div>
            <Input
              label="Confirmar senha"
              type={showPassword ? 'text' : 'password'}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
              className={confirmPwd && confirmPwd !== password ? 'border-danger' : ''}
            />
            <ErrorText>{error}</ErrorText>
            {alreadyRegistered && <p className="text-xs text-text-muted text-center">Redirecionando para o login…</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || alreadyRegistered || !passwordOk(password) || password !== confirmPwd}
            >
              {loading ? 'Enviando…' : 'Cadastrar'}
            </Button>
          </form>
        )}

        {step === 'confirm' && (
          <form onSubmit={handleConfirm} className="space-y-4 mt-3">
            <h1 className="font-display text-xl font-bold text-text text-center">Confirme o e-mail</h1>
            <p className="text-sm text-text-secondary text-center">Enviamos um código para {email}.</p>
            <SpamNotice />
            <Input label="Código" value={code} onChange={(e) => setCode(e.target.value)} required />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Confirmando…' : 'Confirmar'}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-text-secondary hover:text-text"
              >
                Trocar e-mail
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={cooldown > 0 || resending}
                className="text-accent-hover hover:underline disabled:text-text-muted disabled:no-underline disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Reenviar em ${cooldown}s` : resending ? 'Enviando…' : 'Reenviar código'}
              </button>
            </div>
          </form>
        )}
      </Card>
    </AuthBackground>
  )
}
