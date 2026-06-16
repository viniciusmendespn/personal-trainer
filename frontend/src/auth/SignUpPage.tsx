import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp, confirmSignUp, autoSignIn } from 'aws-amplify/auth'
import { useAuth } from './AuthProvider'
import { Button, Input, ErrorText } from '../components/ui'

// Política do pool: 8+ caracteres, maiúscula, minúscula, número (sem símbolo obrigatório).
function pwdOk(p: string) {
  return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p)
}

export function SignUpPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    navigate('/alunos', { replace: true })
    return null
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!pwdOk(password)) {
      setError('Senha: mínimo 8 caracteres, com maiúscula, minúscula e número.')
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
      setError(err instanceof Error ? err.message : 'Falha no cadastro')
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
      navigate('/alunos', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {step === 'form' ? (
        <form onSubmit={handleSignUp} className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-emerald-400 text-center">Criar conta</h1>
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Enviando…' : 'Cadastrar'}
          </Button>
          <p className="text-center text-sm text-slate-400">
            Já tem conta?{' '}
            <Link to="/login" className="text-emerald-400 hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleConfirm} className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-emerald-400 text-center">Confirme o e-mail</h1>
          <p className="text-sm text-slate-400 text-center">Enviamos um código para {email}.</p>
          <Input label="Código" value={code} onChange={(e) => setCode(e.target.value)} required />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Confirmando…' : 'Confirmar'}
          </Button>
        </form>
      )}
    </div>
  )
}
