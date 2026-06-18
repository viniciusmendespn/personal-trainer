// Política do Cognito User Pool (backend/template.yaml: MinimumLength 8, Require Upper/Lower/Numbers, RequireSymbols false)
export const PASSWORD_RULES = [
  { key: 'length', label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'Uma letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Uma letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number', label: 'Um número', test: (p: string) => /[0-9]/.test(p) },
] as const

export function passwordOk(p: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(p))
}

/** Traduz erros do Amplify/Cognito (AuthError.name) para mensagens em PT-BR. */
export function cognitoErrorPtBr(err: unknown): string {
  const name = (err as { name?: string })?.name ?? ''
  const msg = err instanceof Error ? err.message : ''

  if (name === 'NotAuthorizedException') return 'E-mail ou senha incorretos.'
  if (name === 'UserNotConfirmedException') return 'Conta ainda não confirmada. Verifique seu e-mail.'
  if (name === 'UserNotFoundException') return 'Não encontramos uma conta com este e-mail.'
  if (name === 'PasswordResetRequiredException') return 'É necessário redefinir sua senha.'
  if (name === 'UsernameExistsException') return 'Este e-mail já está cadastrado.'
  if (name === 'CodeMismatchException') return 'Código inválido. Confira e tente novamente.'
  if (name === 'ExpiredCodeException') return 'Código expirado. Solicite um novo.'
  if (name === 'LimitExceededException' || name === 'TooManyRequestsException') return 'Muitas tentativas. Aguarde alguns minutos.'
  if (name === 'InvalidPasswordException') return 'A senha não atende aos requisitos mínimos.'
  if (name === 'InvalidParameterException' && msg.toLowerCase().includes('confirm')) return 'Esta conta já está confirmada. Tente fazer login.'
  if (msg.includes('Network') || msg.includes('Failed to fetch')) return 'Erro de conexão. Verifique sua internet.'

  return 'Algo deu errado. Tente novamente.'
}
