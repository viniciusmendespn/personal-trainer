import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle, Eye, PencilLine } from 'lucide-react'
import { mcpApi } from '../api/mcp'
import { useAuth } from '../auth/AuthProvider'
import { AuthBackground } from '../auth/AuthBackground'
import { Button, Card, Spinner } from '../components/ui'

/**
 * Consentimento OAuth de um conector (ChatGPT, Claude, Gemini).
 *
 * O `/authorize` do servidor MCP manda o navegador para cá porque é aqui que existe uma
 * sessão Cognito — o personal já está logado no portal e não precisa digitar senha de novo,
 * nem entregar credencial ao cliente de LLM. Ao aprovar, o backend devolve a URL de retorno
 * já com o `code`; esta página só redireciona.
 */
export function OAuthConsentPage() {
  const [params] = useSearchParams()
  const req = params.get('req') || ''
  const { user } = useAuth()
  const [enviando, setEnviando] = useState<'aprovar' | 'recusar' | null>(null)
  const [erro, setErro] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mcp-authreq', req],
    queryFn: () => mcpApi.getRequest(req),
    enabled: !!req,
    retry: false,
  })

  const [concedidos, setConcedidos] = useState<string[] | null>(null)
  const escopos = data?.scopes ?? []
  const selecionados = concedidos ?? escopos.map((s) => s.id)

  function alternar(id: string) {
    const base = concedidos ?? escopos.map((s) => s.id)
    setConcedidos(base.includes(id) ? base.filter((s) => s !== id) : [...base, id])
  }

  async function aprovar() {
    setErro('')
    setEnviando('aprovar')
    try {
      const { redirect_to } = await mcpApi.approve(req, selecionados)
      window.location.assign(redirect_to)
    } catch {
      setErro('Não foi possível concluir a autorização. Tente conectar novamente pelo aplicativo.')
      setEnviando(null)
    }
  }

  async function recusar() {
    setEnviando('recusar')
    try {
      await mcpApi.deny(req)
    } finally {
      window.location.assign('/config?tab=conexoes')
    }
  }

  if (!req || isError) {
    return (
      <AuthBackground>
        <Card variant="glass" className="w-full max-w-md p-6 text-center">
          <AlertCircle className="mx-auto mb-3 text-danger" size={32} />
          <h1 className="text-lg font-semibold mb-1">Autorização expirada</h1>
          <p className="text-sm text-text-secondary mb-4">
            O pedido de conexão não existe mais ou já foi usado. Volte ao aplicativo e peça
            para conectar de novo.
          </p>
          <Button onClick={() => window.location.assign('/config?tab=conexoes')}>
            Ir para Conexões
          </Button>
        </Card>
      </AuthBackground>
    )
  }

  if (isLoading || !data) {
    return (
      <AuthBackground>
        <Card variant="glass" className="w-full max-w-md p-10 flex justify-center">
          <Spinner />
        </Card>
      </AuthBackground>
    )
  }

  return (
    <AuthBackground>
      <Card variant="glass" className="w-full max-w-md p-6 shadow-[var(--shadow-card)]">
        <div className="text-center mb-5">
          <ShieldCheck className="mx-auto mb-2 text-accent-hover" size={32} />
          <h1 className="text-lg font-semibold">
            Conectar {data.client_name} ao CoachPilot
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Você está autorizando como <strong>{user?.email}</strong>. A conexão só alcança os
            seus alunos.
          </p>
        </div>

        <p className="text-xs font-medium text-text-secondary mb-2">Permissões solicitadas</p>
        <div className="space-y-2 mb-5">
          {escopos.map((s) => (
            <label
              key={s.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-surface-hover"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selecionados.includes(s.id)}
                onChange={() => alternar(s.id)}
              />
              <span className="flex-1 text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  {s.id.includes('write') ? <PencilLine size={14} /> : <Eye size={14} />}
                  {s.id.includes('write') ? 'Escrever' : 'Ler'}
                </span>
                <span className="text-text-secondary">{s.label}</span>
              </span>
            </label>
          ))}
        </div>

        <p className="text-xs text-text-secondary mb-4">
          O conteúdo consultado, incluindo anamnese e avaliações físicas dos seus alunos, será
          enviado a {data.client_name} para responder às suas perguntas. Você pode revogar esta
          conexão a qualquer momento em Configurações → Conexões.
        </p>

        {erro && <p className="text-sm text-danger mb-3">{erro}</p>}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={recusar}
                  disabled={enviando !== null}>
            Recusar
          </Button>
          <Button className="flex-1" onClick={aprovar}
                  disabled={enviando !== null || selecionados.length === 0}>
            {enviando === 'aprovar' ? 'Conectando…' : 'Autorizar'}
          </Button>
        </div>
      </Card>
    </AuthBackground>
  )
}
