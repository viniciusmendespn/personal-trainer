import type { Host } from './host'
import type { Detalhes, Operacao, Proposta, Resumo, ToolResult } from './types'

export function unpack(result: ToolResult) {
  const resumo = result.structuredContent as unknown as Resumo
  const detalhes = (result._meta?.coachpilot ?? {}) as Detalhes
  return { resumo, detalhes }
}
export class CoachPilot {
  constructor(public host: Host) {}
  async aluno(aluno_id: string) { return unpack(await this.host.call('mostrar_aluno', { aluno_id })) }
  async proposta(aluno_id: string, proposta_id: string) { return unpack(await this.host.call('mostrar_proposta_programa', { aluno_id, proposta_id })) }
  async salvar(p: Proposta) {
    return unpack(await this.host.call('salvar_proposta_programa', {
      aluno_id: p.aluno_id, proposta_id: p.proposta_id, revisao_proposta: p.revisao,
      revisao_base: p.revisao_base, resumo_da_mudanca: p.resumo_da_mudanca, programa: p.programa,
    }))
  }
  async aplicar(p: Proposta, confirmar = false): Promise<Operacao> {
    try {
      const result = await this.host.call('aplicar_proposta_programa', { aluno_id: p.aluno_id,
        proposta_id: p.proposta_id, revisao_proposta: p.revisao, confirmar_sessao_em_andamento: confirmar })
      return result.structuredContent as unknown as Operacao
    } catch (error) {
      // Timeout é ambíguo. Consultar a proposta recupera o ID determinado pelo servidor.
      if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
        const result = await this.host.call('obter_proposta_programa', { aluno_id: p.aluno_id, proposta_id: p.proposta_id })
        const current = result.structuredContent as unknown as Proposta
        if (current.operation_id && current.estado === 'aplicada') {
          return (await this.host.call('consultar_operacao_programa', { aluno_id: p.aluno_id, operation_id: current.operation_id })).structuredContent as unknown as Operacao
        }
      }
      throw error
    }
  }
}
