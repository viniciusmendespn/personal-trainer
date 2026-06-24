import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth'
import { Eye, EyeOff } from 'lucide-react'
import { cognitoErrorPtBr, passwordOk } from './cognitoErrors'
import { AuthStepIndicator } from './AuthStepIndicator'
import { PasswordChecklist } from './PasswordChecklist'
import { SpamNotice } from './SpamNotice'
import { Button, Input, ErrorText, Card, useToast } from '../components/ui'
import { AuthBackground } from './AuthBackground'

type Step = 'request' | 'confirm'
const STEP_LABELS = ['E-mail', 'Nova senha']
const STEP_INDEX: Record<Step, number> = { request: 0, confirm: 1 }

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { show } = useToast()

  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword({ username: email })
      setStep('confirm')
    } catch (err) {
      const name = (err as { name?: string })?.name ?? ''
      // Mensagem neutra de propósito: evita confirmar se o e-mail existe ou não.
      if (name === 'UserNotFoundException' || name === 'InvalidParameterException') {
        setStep('confirm')
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
    if (!passwordOk(newPassword)) {
      setError('A senha não atende aos requisitos mínimos.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword })
      show('Senha redefinida com sucesso. Faça login.', 'success')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(cognitoErrorPtBr(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthBackground>
      <Card variant="glass" className="w-full max-w-sm p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-center mb-4">
          <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" style={{ height: 90, width: 'auto' }} />
        </div>
        <AuthStepIndicator labels={STEP_LABELS} currentIndex={STEP_INDEX[step]} />

        {step === 'request' && (
          <form onSubmit={handleRequest} className="space-y-4 mt-3">
            <h1 className="font-display text-xl font-bold text-text text-center">Recuperar senha</h1>
            <p className="text-sm text-text-secondary text-center">
              Informe seu e-mail e, se houver uma conta cadastrada, enviaremos um código de confirmação.
            </p>
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar código'}
            </Button>
            <p className="text-center text-sm text-text-secondary">
              <Link to="/login" className="text-accent-hover hover:underline">
                Voltar ao login
              </Link>
            </p>
          </form>
        )}

        {step === 'confirm' && (
          <form onSubmit={handleConfirm} className="space-y-4 mt-3">
            <h1 className="font-display text-xl font-bold text-text text-center">Redefinir senha</h1>
            <p className="text-sm text-text-secondary text-center">Se {email} tiver uma conta, enviamos um código para lá.</p>
            <SpamNotice />
            <Input label="Código" value={code} onChange={(e) => setCode(e.target.value)} required />
            <div>
              <span className="block text-xs font-medium text-text-secondary mb-1">Nova senha</span>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
              <PasswordChecklist password={newPassword} show={newPassword.length > 0} />
            </div>
            <Input
              label="Confirmar nova senha"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={confirmPassword && confirmPassword !== newPassword ? 'border-danger' : ''}
            />
            <ErrorText>{error}</ErrorText>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !passwordOk(newPassword) || newPassword !== confirmPassword}
            >
              {loading ? 'Redefinindo…' : 'Redefinir senha'}
            </Button>
            <button
              type="button"
              onClick={() => setStep('request')}
              className="block w-full text-center text-sm text-text-secondary hover:text-text"
            >
              Trocar e-mail
            </button>
          </form>
        )}
      </Card>
    </AuthBackground>
  )
}
