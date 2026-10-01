import { describe, expect, it, vi } from 'vitest'
import { assertResult, ToolError, type Host } from './host'
import { CoachPilot, unpack } from './useCases'
import { ordenarAlunos, formatValue } from './presentation'
import type { Aluno, Proposta } from './types'

function host(call: Host['call']): Host {
  return { call, connect: vi.fn(), context: vi.fn(), ask: vi.fn(), expand: vi.fn(), dispose: vi.fn() }
}
const proposta = { aluno_id: 'original', proposta_id: 'p', revisao: 2, revisao_base: 7,
  resumo_da_mudanca: 'Ajuste', programa: { version: '1', treinos: [] } } as unknown as Proposta

describe('casos de uso do CoachPilot', () => {
  it('edita e aplica sempre a proposta e o aluno originais', async () => {
    const call = vi.fn().mockResolvedValue({ structuredContent: { status: 'aplicado', operation_id: 'op' } })
    const api = new CoachPilot(host(call))
    await api.salvar(proposta)
    await api.aplicar(proposta)
    expect(call.mock.calls[0]).toEqual(['salvar_proposta_programa', {
      aluno_id: 'original', proposta_id: 'p', revisao_proposta: 2, revisao_base: 7,
      resumo_da_mudanca: 'Ajuste', programa: proposta.programa,
    }])
    expect(call.mock.calls[1][1]).toMatchObject({ aluno_id: 'original', proposta_id: 'p', revisao_proposta: 2, confirmar_sessao_em_andamento: false })
  })
  it('recupera timeout consultando proposta e operação sem reaplicar', async () => {
    const call = vi.fn().mockRejectedValueOnce(new Error('Request timed out'))
      .mockResolvedValueOnce({ structuredContent: { ...proposta, estado: 'aplicada', operation_id: 'op' } })
      .mockResolvedValueOnce({ structuredContent: { status: 'aplicado', operation_id: 'op' } })
    const op = await new CoachPilot(host(call)).aplicar(proposta)
    expect(op.status).toBe('aplicado')
    expect(call.mock.calls.map(c => c[0])).toEqual(['aplicar_proposta_programa', 'obter_proposta_programa', 'consultar_operacao_programa'])
  })
  it('timeout sem confirmação não é sucesso nem aplicação automática', async () => {
    const call = vi.fn().mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ structuredContent: { ...proposta, estado: 'valida' } })
    await expect(new CoachPilot(host(call)).aplicar(proposta)).rejects.toThrow('timeout')
    expect(call).toHaveBeenCalledTimes(2)
  })
  it('erros de tool são erros reais com código de sessão', () => {
    expect(() => assertResult({ isError: true, content: [{ type: 'text', text: 'Sessão ativa' }],
      _meta: { erro: { code: 'SESSAO_EM_ANDAMENTO', mensagem: 'Confirme' } } })).toThrow(ToolError)
  })
  it('separa dados de apresentação do contexto conciso', () => {
    const result = unpack({ structuredContent: { tela: 'proposta', aluno_id: 'a' }, _meta: { coachpilot: { proposta } } })
    expect(result.resumo).not.toHaveProperty('programa')
    expect(result.detalhes.proposta?.aluno_id).toBe('original')
  })
})

describe('apresentação', () => {
  it('ordena por urgência verificável sem alterar os dados recebidos', () => {
    const alunos = [{ nome: 'Zé', urgencia: 1 }, { nome: 'Ana', urgencia: 3 }, { nome: 'Bia', urgencia: 1 }] as Aluno[]
    expect(ordenarAlunos(alunos, 'urgencia').map(a => a.nome)).toEqual(['Bia', 'Zé', 'Ana'])
    expect(alunos[0].nome).toBe('Zé')
    expect(ordenarAlunos(alunos, 'nome').map(a => a.nome)).toEqual(['Ana', 'Bia', 'Zé'])
  })
  it('prescrição aparece como campos de treino sem diff de JSON', () => {
    expect(formatValue([{ series: 3, reps: '12', carga: '20' }])).toBe('Séries: 3; Repetições / métrica: 12; Carga: 20')
    expect(formatValue(null)).toBe('Não informado')
  })
})
