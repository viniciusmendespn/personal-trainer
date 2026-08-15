import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plug, Copy, Trash2, Info } from 'lucide-react'
import { mcpApi, type McpConexao } from '../../api/mcp'
import { Button, Card, EmptyState, Spinner, useToast, useConfirm } from '../ui'

function quando(iso?: string | null): string {
  if (!iso) return 'ainda não usado'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Conexões com ChatGPT, Claude e Gemini (servidor MCP).
 *
 * Revogar aqui derruba a conexão: o refresh token para na hora e o access token em uso
 * expira em até 15 minutos.
 */
export function ConexoesTab() {
  const qc = useQueryClient()
  const { show } = useToast()
  const confirm = useConfirm()

  const { data, isLoading } = useQuery({
    queryKey: ['mcp-conexoes'],
    queryFn: mcpApi.listConexoes,
  })

  const revogar = useMutation({
    mutationFn: mcpApi.revogar,
    onSuccess: () => {
      show('Conexão revogada.')
      qc.invalidateQueries({ queryKey: ['mcp-conexoes'] })
    },
    onError: () => show('Não foi possível revogar agora.', 'error'),
  })

  async function confirmarRevogacao(c: McpConexao) {
    const ok = await confirm({
      title: `Revogar ${c.client_name}?`,
      message: 'O aplicativo perde o acesso aos seus dados. Para voltar a usar, será preciso '
        + 'conectar de novo.',
      confirmLabel: 'Revogar',
      tone: 'danger',
    })
    if (ok) revogar.mutate(c.conn_id)
  }

  const url = data?.server_url || 'https://mcp.coachpilot.com.br/mcp'

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 text-accent-hover shrink-0" />
          <div className="text-sm text-text-secondary space-y-2">
            <p className="text-text font-medium">
              Converse com seus dados no ChatGPT, Claude ou Gemini
            </p>
            <p>
              Adicione o CoachPilot como conector no aplicativo que você já usa e peça coisas
              como “quem não treina há mais de 10 dias?” ou “monta o treino B da Marina para
              esta semana respeitando a anamnese”. Você autoriza aqui, com a sua conta — nenhuma
              senha é compartilhada.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <code className="px-2 py-1 rounded bg-white/5 text-xs break-all">{url}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(url)
                  show('Endereço copiado.')
                }}
              >
                <Copy size={14} /> Copiar
              </Button>
            </div>
            <p className="text-xs">
              No aplicativo, procure por <strong>Conectores</strong> (Claude e ChatGPT) ou
              configure o servidor MCP (Gemini CLI) e cole esse endereço.
            </p>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Plug size={28} />}
          title="Nenhum aplicativo conectado"
          description="Quando você autorizar o ChatGPT, o Claude ou o Gemini, ele aparece aqui."
        />
      ) : (
        <div className="space-y-2">
          {data.items.map((c) => (
            <Card key={c.conn_id} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">{c.client_name}</p>
                <p className="text-xs text-text-secondary">
                  Conectado em {quando(c.created_at)} · Último uso: {quando(c.last_used_at)}
                </p>
                <ul className="mt-2 space-y-0.5">
                  {c.scopes.map((s) => (
                    <li key={s.id} className="text-xs text-text-secondary">• {s.label}</li>
                  ))}
                </ul>
              </div>
              <Button
                size="sm"
                variant="danger"
                onClick={() => confirmarRevogacao(c)}
                disabled={revogar.isPending}
              >
                <Trash2 size={14} /> Revogar
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
