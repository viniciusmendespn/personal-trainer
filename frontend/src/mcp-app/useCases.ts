import type { Host } from './host'
import type { Detalhes, Resumo, ToolResult } from './types'

/** `structuredContent` é o resumo conciso que o modelo também lê; `_meta` traz o resto só para a tela. */
export function unpack(result: ToolResult) {
  const resumo = result.structuredContent as unknown as Resumo
  const detalhes = (result._meta?.coachpilot ?? {}) as Detalhes
  return { resumo, detalhes }
}
/** A tela só lê. Toda escrita acontece pela conversa, com as tools publicadas. */
export class CoachPilot {
  constructor(public host: Host) {}
  async aluno(aluno_id: string) { return unpack(await this.host.call('mostrar_aluno', { aluno_id })) }
}
