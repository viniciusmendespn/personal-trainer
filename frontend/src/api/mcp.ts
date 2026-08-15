import { api } from './client'

export interface McpScope {
  id: string
  label: string
}

export interface McpAuthRequest {
  client_name: string
  scopes: McpScope[]
}

export interface McpConexao {
  conn_id: string
  client_name: string
  created_at?: string
  last_used_at?: string | null
  scopes: McpScope[]
}

export const mcpApi = {
  /** Dados da autorização pendente, para a tela de consentimento. */
  getRequest: (req: string) =>
    api.get<McpAuthRequest>(`/v1/mcp/oauth/request/${req}`).then((r) => r.data),
  /** Aprova e devolve a URL de retorno já com o `code` — o front só redireciona. */
  approve: (req: string, scopes: string[]) =>
    api.post<{ redirect_to: string }>('/v1/mcp/oauth/approve', { req, scopes }).then((r) => r.data),
  deny: (req: string) =>
    api.post('/v1/mcp/oauth/deny', { req, scopes: [] }).then((r) => r.data),

  listConexoes: () =>
    api.get<{ items: McpConexao[]; server_url: string }>('/v1/mcp/conexoes').then((r) => r.data),
  revogar: (connId: string) => api.delete(`/v1/mcp/conexoes/${connId}`).then((r) => r.data),
}
