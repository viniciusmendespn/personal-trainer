import { describe, expect, it } from 'vitest'
import { agruparDiferencas, coberturaEvolucao, lerAnamnese, melhorValor, resumoDiferencas, situacaoPrograma, treinoRelevante } from './presentation'
import { descreverBloco } from './Programa'
import type { Contexto, Diferenca, Exercicio, Programa, Treino } from './types'

const ex = (nome: string, extra: Partial<Exercicio> = {}): Exercicio => ({ nome, tipo_exercicio: 'FORCA', substitutos: [], ...extra })
const treino = (nome: string, exercicios: Exercicio[], extra: Partial<Treino> = {}): Treino => ({ nome, ativo: true, blocos: [], exercicios, ...extra })
const prog = (...treinos: Treino[]): Programa => ({ version: '1', treinos })

describe('agrupamento de diferenças', () => {
  const base = prog(treino('A', [ex('Agachamento'), ex('Remada')]), treino('B', [ex('Supino')]))
  const programa = prog(treino('A', [ex('Agachamento'), ex('Remada')]), treino('B', [ex('Supino'), ex('Prancha', { tipo_exercicio: 'PERFORMANCE', unidade_reps: 's' })]))

  it('junta os campos do mesmo exercício numa decisão só', () => {
    const diferencas: Diferenca[] = [
      { caminho: 'treinos[0].exercicios[1].intervalo_s', nome: 'Remada', tipo: 'alterado', campo: 'intervalo_s', atual: 60, proposto: 90 },
      { caminho: 'treinos[0].exercicios[1].series_prescritas', nome: 'Remada', tipo: 'alterado', campo: 'series_prescritas', atual: [], proposto: [] },
      { caminho: 'treinos[0].exercicios[1].observacoes', nome: 'Remada', tipo: 'alterado', campo: 'observacoes', atual: null, proposto: 'Pegada neutra' },
      { caminho: 'treinos[1].exercicios[1]', nome: 'Prancha', tipo: 'adicionado', atual: null, proposto: programa.treinos[1].exercicios[1] },
    ]
    const grupos = agruparDiferencas({ diferencas, programa, programa_base: base })
    expect(grupos).toHaveLength(2)
    expect(grupos[0]).toMatchObject({ treino: 'A', exercicio: 'Remada', tipo: 'alterado' })
    expect(grupos[0].campos).toHaveLength(3)
    expect(grupos[1]).toMatchObject({ treino: 'B', exercicio: 'Prancha', tipo: 'adicionado' })
    expect(resumoDiferencas(grupos)).toBe('2 exercícios com mudança em 2 treinos')
  })

  it('usa as unidades de cada lado ao comparar séries de PERFORMANCE', () => {
    const diferencas: Diferenca[] = [
      { caminho: 'treinos[1].exercicios[1].unidade_reps', nome: 'Prancha', tipo: 'alterado', campo: 'unidade_reps', atual: 'reps', proposto: 's' },
      { caminho: 'treinos[1].exercicios[1].series_prescritas', nome: 'Prancha', tipo: 'alterado', campo: 'series_prescritas', atual: [], proposto: [] },
    ]
    const [g] = agruparDiferencas({ diferencas, programa, programa_base: base })
    expect(g.exProposto?.unidade_reps).toBe('s')
    expect(g.exAtual?.unidade_reps).toBe('reps')
    expect(g.exAtual?.tipo_exercicio).toBe('PERFORMANCE')
  })

  it('mudança só de posição não vira ajuste nem remoção', () => {
    const diferencas: Diferenca[] = [{ caminho: 'treinos[0].exercicios[0].ordem', nome: 'Remada', tipo: 'alterado', campo: 'ordem', atual: 1, proposto: 0 }]
    expect(agruparDiferencas({ diferencas, programa, programa_base: base })[0].tipo).toBe('reordenado')
  })

  it('treino inteiro incluído ou removido é contado como treino, não como campo', () => {
    const diferencas: Diferenca[] = [
      { caminho: 'treinos[0]', nome: 'C', tipo: 'adicionado', atual: null, proposto: treino('C', []) },
      { caminho: 'treinos[1]', nome: 'Antigo', tipo: 'removido', atual: treino('Antigo', []), proposto: null },
    ]
    expect(resumoDiferencas(agruparDiferencas({ diferencas, programa, programa_base: base }))).toBe('1 treino incluído · 1 treino removido')
  })

  it('remoção e inclusão no mesmo índice são decisões separadas', () => {
    const diferencas: Diferenca[] = [
      { caminho: 'treinos[1].exercicios[0]', nome: 'Supino', tipo: 'removido', atual: base.treinos[1].exercicios[0], proposto: null },
      { caminho: 'treinos[1].exercicios[0]', nome: 'Supino inclinado', tipo: 'adicionado', atual: null, proposto: ex('Supino inclinado') },
    ]
    expect(agruparDiferencas({ diferencas, programa, programa_base: base }).map(g => g.tipo)).toEqual(['removido', 'adicionado'])
  })
})

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
