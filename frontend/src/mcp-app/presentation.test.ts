import { describe, expect, it } from 'vitest'
import { coberturaEvolucao, historicoDor, lerAnamnese, melhorValor, situacaoPrograma, treinoRelevante } from './presentation'
import { descreverBloco } from './Programa'
import type { Contexto, Exercicio, Programa, Treino } from './types'

const treino = (nome: string, exercicios: Exercicio[], extra: Partial<Treino> = {}): Treino => ({ nome, ativo: true, blocos: [], exercicios, ...extra })
const prog = (...treinos: Treino[]): Programa => ({ version: '1', treinos })

describe('evolução', () => {
  it('honra a direção da métrica', () => {
    expect(melhorValor([42, 38, 40], 'MENOR')).toBe(38)
    expect(melhorValor([42, 38, 40], 'MAIOR')).toBe(42)
    expect(melhorValor([42, 38, 40], null)).toBe(42)
    expect(melhorValor([], 'MENOR')).toBeNull()
  })
  it('não apresenta consulta no teto como histórico completo', () => {
    expect(coberturaEvolucao(200, 200)).toMatch(/pode haver registros mais antigos/)
    expect(coberturaEvolucao(12, 200)).toBe('todos os registros encontrados')
  })
})

describe('programa', () => {
  it('resume a situação sem extrapolar', () => {
    expect(situacaoPrograma(prog(), '2026-10-01')).toEqual({ texto: 'Sem programa vigente', alerta: true })
    expect(situacaoPrograma(prog(treino('A', [], { data_fim: '2026-09-01' })), '2026-10-01').alerta).toBe(true)
    expect(situacaoPrograma(prog(treino('A', [], { data_fim: '2026-10-20' }), treino('B', [], { data_fim: '2026-10-10' })), '2026-10-01'))
      .toEqual({ texto: '2 treinos ativos · vence em 10/10/2026', alerta: false })
  })
  it('abre o primeiro treino vigente', () => {
    expect(treinoRelevante(prog(treino('A', [], { data_fim: '2026-09-01' }), treino('B', [])), '2026-10-01')).toBe(1)
  })
  it('descreve blocos em linguagem de treino', () => {
    expect(descreverBloco({ formato: 'AMRAP', params: { duracao_s: 1200, rounds: null } })).toBe('AMRAP · 20 min')
    expect(descreverBloco({ formato: 'EMOM', params: { duracao_s: 600, intervalo_s: 90 } })).toBe('EMOM · 10 min · a cada 90s')
    expect(descreverBloco({ descanso: true, params: { duracao_s: 120 } })).toBe('Descanso · 2 min')
  })
})

describe('anamnese', () => {
  const contexto = (respostas: { pergunta: string; resposta: string }[]) => ({ anamnese: { respostas } }) as unknown as Contexto
  it('separa rotina e saúde usando só respostas registradas', () => {
    const { rotina, saude } = lerAnamnese(contexto([
      { pergunta: 'Quantos dias por semana pode treinar?', resposta: '3' },
      { pergunta: 'Quanto tempo tem disponível por treino?', resposta: '45 min' },
      { pergunta: 'Há quanto tempo você treina?', resposta: '2 anos' },
      { pergunta: 'Tem ou já teve lesão, dor articular ou problema na coluna? Onde?', resposta: 'Ombro direito' },
      { pergunta: 'Usa algum medicamento contínuo? Qual?', resposta: 'Não' },
      { pergunta: 'É fumante?', resposta: 'False' },
    ]))
    expect(Object.fromEntries(rotina.map(r => [r.rotulo, r.resposta]))).toEqual({ 'Dias por semana': '3', 'Tempo por treino': '45 min', Local: null, 'Experiência': '2 anos' })
    expect(saude.map(r => r.resposta)).toEqual(['Ombro direito'])
  })
})

describe('respostas da anamnese', () => {
  it('mostra como o aluno responderia', async () => {
    const { respostaLegivel, respostaNegativa } = await import('./presentation')
    expect(respostaLegivel('False')).toBe('Não')
    expect(respostaLegivel('True')).toBe('Sim')
    expect(respostaLegivel("['Academia', 'Em casa']")).toBe('Academia, Em casa')
    expect(respostaLegivel('45 minutos')).toBe('45 minutos')
    expect(respostaNegativa('False')).toBe(true)
    expect(respostaNegativa('Ombro direito')).toBe(false)
  })
})

describe('histórico de dor', () => {
  const ctx = (relatos: Contexto['dores_e_duvidas']) => ({ dores_e_duvidas: relatos }) as unknown as Contexto
  const dor = (exercicio: string | null, data: string, respondido = true) => ({ tipo: 'DOR', descricao: 'x', exercicio, data, respondido })

  it('agrupa as respondidas por exercício, mais frequente primeiro, e traz a última data', () => {
    const h = historicoDor(ctx([dor('Supino', '2026-09-12'), dor('Agachamento', '2026-09-20'), dor('supino', '2026-08-01'),
      dor(null, '2026-07-01'), dor('Remada', '2026-09-30', false)]))
    expect(h).toEqual({ exercicios: [{ nome: 'Supino', vezes: 2 }, { nome: 'Agachamento', vezes: 1 }, { nome: 'geral', vezes: 1 }],
      ultima: '2026-09-20', parcial: false })
  })

  it('sem dor respondida não há histórico; dúvida não conta', () => {
    expect(historicoDor(ctx([dor('Supino', '2026-09-12', false), { tipo: 'DUVIDA', descricao: 'x', respondido: true }]))).toBeNull()
  })

  it('no teto de relatos respondidos avisa que pode haver mais antigos', () => {
    const relatos = Array.from({ length: 10 }, (_, i) => ({ ...dor('Supino', `2026-09-${String(i + 1).padStart(2, '0')}`), tipo: i < 3 ? 'DOR' : 'DUVIDA' }))
    expect(historicoDor(ctx(relatos))?.parcial).toBe(true)
  })
})
