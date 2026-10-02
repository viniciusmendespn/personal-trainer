import type { Aluno, Contexto, Programa } from './types'

export function ordenarAlunos(items: Aluno[], ordem: string): Aluno[] {
  return [...items].sort((a, b) => (ordem === 'urgencia' ? a.urgencia - b.urgencia : 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ── Programa ────────────────────────────────────────────────────────────────
/** Situação do programa em uma linha: o que o personal precisa saber antes de mexer nele. */
export function situacaoPrograma(programa: Programa | undefined, hoje: string): { texto: string; alerta: boolean } {
  const ativos = (programa?.treinos ?? []).filter(t => t.ativo)
  if (!ativos.length) return { texto: 'Sem programa vigente', alerta: true }
  const nome = `${ativos.length} treino${ativos.length > 1 ? 's' : ''} ativo${ativos.length > 1 ? 's' : ''}`
  const fins = ativos.map(t => t.data_fim).filter((d): d is string => !!d).sort()
  if (!fins.length) return { texto: `${nome} · sem data de vencimento`, alerta: false }
  const vencidos = ativos.filter(t => t.data_fim && t.data_fim < hoje).length
  if (vencidos === ativos.length) return { texto: `${nome} · vencido desde ${fmtDia(fins[fins.length - 1])}`, alerta: true }
  if (vencidos) return { texto: `${nome} · ${vencidos} vencido${vencidos > 1 ? 's' : ''}`, alerta: true }
  return { texto: `${nome} · vence em ${fmtDia(fins[0])}`, alerta: false }
}

/** Qual treino abrir primeiro: o primeiro ativo e não vencido; senão o primeiro. */
export function treinoRelevante(programa: Programa, hoje: string): number {
  const i = programa.treinos.findIndex(t => t.ativo && !(t.data_fim && t.data_fim < hoje))
  return i >= 0 ? i : 0
}

function fmtDia(d: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d
}

// ── Evolução ────────────────────────────────────────────────────────────────
/** Melhor valor respeitando a direção da métrica: tempo de prova, por exemplo, é melhor quando menor. */
export function melhorValor(valores: number[], direcao?: string | null): number | null {
  if (!valores.length) return null
  return direcao === 'MENOR' ? Math.min(...valores) : Math.max(...valores)
}

/** Cobertura honesta da consulta: com o teto atingido, pode haver registros mais antigos. */
export function coberturaEvolucao(carregados: number, limite: number): string {
  return carregados >= limite ? `últimos ${limite} registros; pode haver registros mais antigos` : 'todos os registros encontrados'
}

// ── Anamnese ────────────────────────────────────────────────────────────────
// Só reorganiza respostas registradas pelo aluno, com a pergunta original: nada é inferido.
const ROTINA: [string, RegExp][] = [
  ['Dias por semana', /dias por semana|quantas vezes.*treinar/i],
  ['Tempo por treino', /tempo (tem )?dispon|minutos por (treino|sess)/i],
  ['Local', /onde vai treinar|local de treino|equipamento/i],
  ['Experiência', /h[aá] quanto tempo.*treina|experi[eê]ncia/i],
]
const SAUDE = /cora[cç][aã]o|press[aã]o|dor\b|tontura|desmai|doen[cç]a|medicament|les[aã]o|coluna|cirurgia|restri[cç]|gr[aá]vida|limita/i
const NEGATIVA = /^(n[aã]o|false|nenhum[a]?|nada|sem|-|n\/a)[.!]?$/i

/** Resposta como o aluno a daria: "False" → "Não", "['a', 'b']" → "a, b". */
export function respostaLegivel(v: string): string {
  const t = v.trim()
  if (/^true$/i.test(t)) return 'Sim'
  if (/^false$/i.test(t)) return 'Não'
  const lista = /^\[(.*)\]$/.exec(t)
  if (lista) return lista[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).join(', ')
  return t
}
export const respostaNegativa = (v: string) => NEGATIVA.test(respostaLegivel(v))

export function lerAnamnese(c: Contexto) {
  const respostas = (c.anamnese?.respostas ?? []).map(r => ({ ...r, resposta: respostaLegivel(r.resposta) }))
  const rotina = ROTINA.map(([rotulo, re]) => ({ rotulo, resposta: respostas.find(r => re.test(r.pergunta))?.resposta ?? null }))
  const saude = respostas.filter(r => SAUDE.test(r.pergunta) && !NEGATIVA.test(r.resposta.trim()))
  return { rotina, saude }
}

export function frequencia(c: Contexto): string | null {
  const e = c.estatisticas_treino
  if (!e) return null
  if (!e.total_sessoes) return 'Nenhuma sessão registrada'
  const media = e.media_sessoes_por_semana.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return `${e.sessoes_semana_atual} sess${e.sessoes_semana_atual === 1 ? 'ão' : 'ões'} nesta semana · média ${media}/semana`
}

/** Teto de relatos respondidos (dor + dúvida) que o contexto traz — `MAX_RELATOS_RESPONDIDOS`
 *  em `contexto_aluno_service.py`. Bateu o teto: pode haver mais antigos fora da conta. */
export const MAX_RELATOS_RESPONDIDOS = 10

/** Dores já respondidas agrupadas por exercício: responder não quer dizer que a dor passou. */
export function historicoDor(c: Contexto): { exercicios: { nome: string; vezes: number }[]; ultima: string | null; parcial: boolean } | null {
  const respondidas = c.dores_e_duvidas.filter(r => r.respondido)
  const dores = respondidas.filter(r => r.tipo === 'DOR')
  if (!dores.length) return null
  const porExercicio = new Map<string, { nome: string; vezes: number; ultima: string }>()
  for (const r of dores) {
    const nome = r.exercicio?.trim() || 'geral'
    const atual = porExercicio.get(nome.toLowerCase()) ?? { nome, vezes: 0, ultima: '' }
    atual.vezes += 1
    if ((r.data ?? '') > atual.ultima) atual.ultima = r.data ?? ''
    porExercicio.set(nome.toLowerCase(), atual)
  }
  const exercicios = [...porExercicio.values()].sort((a, b) => b.vezes - a.vezes || b.ultima.localeCompare(a.ultima))
  const ultima = dores.map(r => r.data ?? '').sort().pop() || null
  return { exercicios: exercicios.map(({ nome, vezes }) => ({ nome, vezes })), ultima, parcial: respondidas.length >= MAX_RELATOS_RESPONDIDOS }
}
