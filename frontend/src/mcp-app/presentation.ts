import type { Aluno, Contexto, Diferenca, Exercicio, Programa, Proposta } from './types'

export const labels: Record<string, string> = {
  series_prescritas: 'Séries, repetições e carga', intervalo_s: 'Intervalo (s)', observacoes: 'Observações',
  data_inicio: 'Início', data_fim: 'Fim', ativo: 'Ativo', nome: 'Nome', foco: 'Foco', ordem: 'Ordem',
  video_url: 'Vídeo', substitutos: 'Substitutos', grupos: 'Grupos musculares', grupo: 'Grupo',
  tipo_exercicio: 'Tipo de exercício', unidade_carga: 'Unidade da carga', unidade_reps: 'Unidade da métrica',
  metrica_direcao: 'Direção do recorde', blocos: 'Blocos', bloco_id: 'Bloco', aquecimento: 'Aquecimento',
  reps: 'Repetições / métrica', carga: 'Carga', series: 'Séries', formato: 'Formato', duracao_s: 'Duração (s)',
}
export function formatValue(value: unknown): string {
  if (value == null || value === '') return 'Não informado'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(' · ') : 'Nenhum'
  if (typeof value === 'object') return Object.entries(value).filter(([k, v]) => !['origem_id', 'ref'].includes(k) && v != null)
    .map(([k, v]) => `${labels[k] ?? k.replaceAll('_', ' ')}: ${formatValue(v)}`).join('; ')
  return String(value)
}
export function ordenarAlunos(items: Aluno[], ordem: string): Aluno[] {
  return [...items].sort((a, b) => (ordem === 'urgencia' ? a.urgencia - b.urgencia : 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
}
export function estadoLabel(estado: string) {
  return ({ valida: 'Proposta — ainda não aplicada', invalida: 'Corrija os erros antes de aplicar',
    desatualizada: 'Programa alterado — revise uma nova proposta', expirada: 'Proposta expirada',
    aplicada: 'Programa aplicado', descartada: 'Proposta descartada' } as Record<string, string>)[estado] ?? 'Rascunho'
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

// ── Proposta ────────────────────────────────────────────────────────────────
export type TipoGrupo = 'adicionado' | 'removido' | 'alterado' | 'reordenado'
export interface GrupoDiferenca {
  chave: string; treino: string; exercicio: string | null; tipo: TipoGrupo
  /** Diferenças de campo do mesmo item (vazio em adição/remoção). */
  campos: Diferenca[]
  /** Item inteiro adicionado/removido. */
  item?: unknown
  /** Exercício de cada lado, para formatar séries com as unidades certas. */
  exAtual?: Exercicio; exProposto?: Exercicio
}

const UNIDADES = ['tipo_exercicio', 'unidade_carga', 'unidade_reps'] as const

/** Uma decisão por exercício (ou treino): campos do mesmo item ficam juntos. */
export function agruparDiferencas(p: Pick<Proposta, 'diferencas' | 'programa' | 'programa_base'>): GrupoDiferenca[] {
  const grupos = new Map<string, GrupoDiferenca>()
  for (const d of p.diferencas) {
    const m = /^treinos\[(\d+)\](?:\.exercicios\[(\d+)\])?(?:\.([a-z_]+))?$/.exec(d.caminho)
    const ti = m ? Number(m[1]) : -1
    const ei = m?.[2] != null ? Number(m[2]) : null
    const ehCampo = !!d.campo
    const removido = d.tipo === 'removido'
    // Exercício só aparece em treino pareado, cujo índice é o do programa proposto.
    const treinoNome = ei == null ? d.nome : p.programa.treinos[ti]?.nome ?? 'Treino'
    const caminhoItem = ehCampo ? d.caminho.replace(/\.[a-z_]+$/, '') : d.caminho
    const chave = `${caminhoItem}|${removido ? 'r' : d.tipo === 'adicionado' ? 'a' : 'c'}|${d.nome}`
    let g = grupos.get(chave)
    if (!g) {
      const exProposto = ei != null && !removido ? p.programa.treinos[ti]?.exercicios[ei] : undefined
      g = { chave, treino: treinoNome, exercicio: ei == null ? null : d.nome, tipo: ehCampo ? 'reordenado' : d.tipo as TipoGrupo,
        campos: [], exProposto, exAtual: exProposto }
      grupos.set(chave, g)
    }
    if (!ehCampo) { g.item = removido ? d.atual : d.proposto; continue }
    g.campos.push(d)
    if (d.campo !== 'ordem') g.tipo = 'alterado'
    if (g.exAtual && (UNIDADES as readonly string[]).includes(d.campo!)) g.exAtual = { ...g.exAtual, [d.campo!]: d.atual } as Exercicio
  }
  return [...grupos.values()]
}

/** "3 exercícios com mudança em 2 treinos · 1 treino incluído" — contagem por decisão, não por campo. */
export function resumoDiferencas(grupos: GrupoDiferenca[]): string {
  if (!grupos.length) return 'Nenhuma alteração na prescrição'
  const plural = (n: number, s: string, p: string) => `${n} ${n > 1 ? p : s}`
  const exs = grupos.filter(g => g.exercicio)
  const treinos = grupos.filter(g => !g.exercicio)
  const conta = (t: TipoGrupo) => treinos.filter(g => g.tipo === t).length
  const ajustados = new Set(treinos.filter(g => g.tipo === 'alterado' || g.tipo === 'reordenado').map(g => g.treino)).size
  return [
    exs.length && `${plural(exs.length, 'exercício', 'exercícios')} com mudança em ${plural(new Set(exs.map(g => g.treino)).size, 'treino', 'treinos')}`,
    conta('adicionado') && plural(conta('adicionado'), 'treino incluído', 'treinos incluídos'),
    conta('removido') && plural(conta('removido'), 'treino removido', 'treinos removidos'),
    ajustados && `dados de ${plural(ajustados, 'treino ajustados', 'treinos ajustados')}`,
  ].filter(Boolean).join(' · ')
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

export function lerAnamnese(c: Contexto) {
  const respostas = c.anamnese?.respostas ?? []
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
