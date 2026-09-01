import { useQuery } from '@tanstack/react-query'
import { mcpApi } from '../api/mcp'

export const MCP_CONEXOES_KEY = ['mcp-conexoes']

/**
 * Conexões de IA autorizadas (ChatGPT, Claude, Gemini).
 *
 * Compartilhada entre a aba Conexões e o aviso da tela de Alunos — mesma queryKey,
 * então o aviso não gera chamada extra quando o personal acabou de abrir Configurações.
 * `staleTime` alto porque conectar/revogar é raro e a invalidação é explícita no revogar.
 */
export function useMcpConexoes() {
  return useQuery({
    queryKey: MCP_CONEXOES_KEY,
    queryFn: mcpApi.listConexoes,
    staleTime: 5 * 60_000,
  })
}
