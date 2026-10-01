import { describe, expect, it, vi } from 'vitest'
import { assertResult, ToolError, type Host } from './host'
import { CoachPilot, unpack } from './useCases'
import { ordenarAlunos } from './presentation'
import { pedidos } from './Workspace'
import type { Aluno } from './types'

function host(call: Host['call']): Host {
  return { call, connect: vi.fn(), context: vi.fn(), ask: vi.fn(), expand: vi.fn(), dispose: vi.fn() }
}
/** As 13 tools publicadas — os pedidos da tela só podem citar estas (e as de leitura visual). */
const PUBLICADAS = ['guia_de_prescricao', 'listar_alunos', 'detalhar_aluno', 'exportar_programa_treino',
  'listar_biblioteca_exercicios', 'historico_sessoes', 'evolucao_exercicio', 'resumo_carteira', 'agenda_periodo',
  'validar_programa_treino', 'aplicar_programa_treino', 'atualizar_treino', 'desfazer_alteracao_treino']

describe('casos de uso do CoachPilot', () => {
  it('a tela só lê: abrir aluno chama apenas a consulta visual', async () => {
    const call = vi.fn().mockResolvedValue({ structuredContent: { tela: 'aluno', aluno_id: 'a' }, _meta: { coachpilot: { programa: { treinos: [] } } } })
    const r = await new CoachPilot(host(call)).aluno('a')
    expect(call.mock.calls).toEqual([['mostrar_aluno', { aluno_id: 'a' }]])
    expect(r.detalhes.programa?.treinos).toEqual([])
  })
  it('erros de tool são erros reais com código de sessão', () => {
    expect(() => assertResult({ isError: true, content: [{ type: 'text', text: 'Sessão ativa' }],
      _meta: { erro: { code: 'SESSAO_EM_ANDAMENTO', mensagem: 'Confirme' } } })).toThrow(ToolError)
  })
  it('separa dados de apresentação do contexto conciso', () => {
    const result = unpack({ structuredContent: { tela: 'aluno', aluno_id: 'a' }, _meta: { coachpilot: { programa: { treinos: [] } } } })
    expect(result.resumo).not.toHaveProperty('programa')
    expect(result.detalhes.programa).toBeDefined()
  })
})

describe('pedidos à conversa', () => {
  const textos = [
    pedidos.revisar('Mariana', 'a1', true), pedidos.revisar('Mariana', 'a1', false),
    pedidos.ajustar('Mariana', 'a1', 'Treino B'), pedidos.renovar('Mariana', 'a1', 'Treino B'),
    pedidos.trocar('Mariana', 'a1', 'Treino B', 'Remada'), pedidos.desfazer('Mariana', 'a1'),
    pedidos.fila('com treino vencido', [{ nome: 'Mariana', aluno_id: 'a1' }, { nome: 'Rafael', aluno_id: 'r1' }] as Aluno[]),
  ]
  it('identificam o aluno explicitamente e pedem confirmação antes de gravar', () => {
    for (const t of textos) {
      expect(t).toMatch(/aluno_id=a1/)
      expect(t).toMatch(/confirm/)
    }
  })
  it('só citam tools publicadas', () => {
    for (const t of textos) {
      const citadas = t.match(/\b[a-z]+(?:_[a-z]+)+\b/g)?.filter(x => x !== 'aluno_id' && x !== 'treino_id') ?? []
      for (const nome of citadas) expect(PUBLICADAS).toContain(nome)
    }
  })
})

describe('apresentação', () => {
  it('ordena por urgência verificável sem alterar os dados recebidos', () => {
    const alunos = [{ nome: 'Zé', urgencia: 1 }, { nome: 'Ana', urgencia: 3 }, { nome: 'Bia', urgencia: 1 }] as Aluno[]
    expect(ordenarAlunos(alunos, 'urgencia').map(a => a.nome)).toEqual(['Bia', 'Zé', 'Ana'])
    expect(alunos[0].nome).toBe('Zé')
    expect(ordenarAlunos(alunos, 'nome').map(a => a.nome)).toEqual(['Ana', 'Bia', 'Zé'])
  })
})
