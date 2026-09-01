import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plug, Copy, Trash2, Sparkles, ExternalLink } from 'lucide-react'
import { mcpApi, type McpConexao } from '../../api/mcp'
import { useMcpConexoes, MCP_CONEXOES_KEY } from '../../hooks/useMcpConexoes'
import { CHATGPT_APP_URL } from '../../lib/links'
import { Badge, Button, Card, EmptyState, Spinner, useToast, useConfirm } from '../ui'

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

  const { data, isLoading } = useMcpConexoes()

  const revogar = useMutation({
    mutationFn: mcpApi.revogar,
    onSuccess: () => {
      show('Conexão revogada.')
      qc.invalidateQueries({ queryKey: MCP_CONEXOES_KEY })
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
          <Sparkles size={18} className="mt-0.5 text-accent-hover shrink-0" />
          <div>
            <p className="text-text font-medium">
              Converse com seus dados no ChatGPT, Claude ou Gemini
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Pergunte em português — <em>“quem não treina há mais de 10 dias?”</em>, <em>“monta o
              treino B da Marina respeitando a anamnese”</em>. O login acontece aqui, você escolhe
              entre somente leitura ou leitura e escrita de treinos, e nenhuma senha é compartilhada.
            </p>
          </div>
        </div>

        {/* Dois caminhos, lado a lado: o app pronto e o endereço para colar. */}
        <div className="grid gap-3 sm:grid-cols-2 mt-4">
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">ChatGPT</span>
              <Badge tone="success">mais rápido</Badge>
            </div>
            <p className="text-xs text-text-secondary mt-1.5 flex-1">
              App pronto no diretório: instala em 3 cliques, funciona na conta gratuita e também no
              aplicativo de celular.
            </p>
            <a href={CHATGPT_APP_URL} target="_blank" rel="noopener noreferrer" className="mt-3">
              <Button size="sm" className="w-full">
                <span className="flex items-center justify-center gap-2">
                  <ExternalLink size={14} /> Instalar no ChatGPT
                </span>
              </Button>
            </a>
          </div>

          <div className="rounded-xl border border-border bg-white/[0.02] p-4 flex flex-col">
            <span className="text-sm font-medium text-text">Claude ou Gemini</span>
            <p className="text-xs text-text-secondary mt-1.5 flex-1">
              Cole este endereço como conector — no Claude, em <em>Settings → Connectors</em>; no
              Gemini, pelo CLI.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <code className="flex-1 min-w-0 px-2 py-1.5 rounded bg-white/5 text-xs break-all">{url}</code>
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
          action={(
            <a href={CHATGPT_APP_URL} target="_blank" rel="noopener noreferrer">
              <Button>
                <span className="flex items-center gap-2">
                  <ExternalLink size={16} /> Instalar no ChatGPT
                </span>
              </Button>
            </a>
          )}
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
