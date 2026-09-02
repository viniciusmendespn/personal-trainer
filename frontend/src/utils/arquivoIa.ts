import type { ExLib } from '../types'
import { gruposDoExercicio, grupoLegado } from './grupos'

/** Referência enxuta de um exercício da biblioteca, para dar de contexto à IA:
 *  nome EXATO (para casar por chave canônica no import) + grupos + vídeo. */
export interface BibliotecaRefIA {
  nome: string
  grupos: string[]
  /** `grupos.join(', ')` — a IA antiga (e os arquivos já gerados) ainda leem este campo. */
  grupo: string | null
  video_url: string | null
}

/** URL de busca no YouTube — fallback de exibição, NÃO um vídeo. Itens antigos da biblioteca
 *  têm isso gravado em `video_url`; apresentá-lo à IA como "o vídeo do exercício" faz a IA
 *  concluir que a biblioteca não tem vídeos e sair buscando os dela. Espelha
 *  `biblioteca_service.eh_busca_youtube` no backend. */
function ehBuscaYoutube(url?: string | null): boolean {
  return !!url && url.includes('youtube.com/results')
}

/** Biblioteca enxuta e ordenada (primeiro grupo, depois nome) para embutir no arquivo da IA.
 *  Ignora exercícios ocultos (`ativo === false`) e zera URLs de busca.
 *  Espelha `biblioteca_service.listar_para_ia` no backend. */
export function slimBiblioteca(lib: ExLib[]): BibliotecaRefIA[] {
  return lib
    .filter((e) => e.ativo !== false)
    .map((e) => {
      const grupos = gruposDoExercicio(e)
      return {
        nome: e.nome,
        grupos,
        grupo: grupoLegado(grupos) ?? null,
        video_url: ehBuscaYoutube(e.video_url) ? null : e.video_url ?? null,
      }
    })
    .sort(
      (a, b) =>
        a.grupos[0].localeCompare(b.grupos[0], 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )
}

/** Biblioteca como lista markdown agrupada por grupo muscular — ~1 linha por exercício, contra
 *  as ~6 do JSON indentado. Numa biblioteca de 150 exercícios isso é a diferença entre ~900 e
 *  ~170 linhas no arquivo, o que decide se uma IA gratuita consegue ou não chegar até o fim.
 *
 *  Um exercício aparece uma vez só, sob o primeiro grupo; os demais vão entre colchetes ao lado
 *  do nome. Espelha `biblioteca_service.markdown_para_ia`. */
export function bibliotecaMarkdown(slim: BibliotecaRefIA[]): string {
  if (!slim.length) return '_(o personal ainda não cadastrou exercícios — monte tudo do zero)_'
  const porGrupo = new Map<string, BibliotecaRefIA[]>()
  for (const ex of slim) {
    const g = ex.grupos[0]
    const lista = porGrupo.get(g)
    if (lista) lista.push(ex)
    else porGrupo.set(g, [ex])
  }
  const linhas: string[] = []
  for (const [grupo, exs] of porGrupo) {
    linhas.push(`**${grupo}**`)
    for (const ex of exs) {
      const extras = ex.grupos.length > 1 ? ` [${ex.grupos.join(', ')}]` : ''
      linhas.push(`- ${ex.nome}${extras} → ${ex.video_url ?? '(sem vídeo cadastrado)'}`)
    }
    linhas.push('')
  }
  return linhas.join('\n').trimEnd()
}

/** Busca o texto de um prompt estático servido em /public. */
export async function fetchPromptMd(path: string): Promise<string> {
  const res = await fetch(path, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Falha ao carregar ${path} (${res.status})`)
  return res.text()
}

export interface SecaoDados {
  titulo: string
  /** Texto (já em markdown) exibido antes do bloco de dados; opcional. */
  nota?: string
  json: unknown
}

/** Marcador no corpo do prompt onde a biblioteca é injetada — fica junto da regra que a usa,
 *  em vez de solta no fim do arquivo, longe de onde a IA precisa dela. */
export const MARCADOR_BIBLIOTECA = '{{BIBLIOTECA}}'

/** Marcador da regra de ouro nº 6, a única que muda conforme por onde a IA entrega o
 *  resultado. O corpo do prompt é compartilhado com `backend/app/mcp/prompts/montar_treino.md`
 *  (um teste garante que sejam idênticos); lá o servidor injeta "chame `aplicar_programa_treino`",
 *  aqui injetamos o copia-e-cola, que é o fluxo deste arquivo. */
export const MARCADOR_ENTREGA = '{{ENTREGA}}'

export const ENTREGA_MANUAL =
  '**Exiba o JSON no chat**, num bloco ` ```json `. **Não crie arquivo para download** — o ' +
  'personal copia da tela e cola no CoachPilot.'

/** Substitui o marcador pela biblioteca renderizada. Se o prompt não tiver o marcador
 *  (versão antiga em cache do CloudFront), anexa no fim — nunca perde a biblioteca. */
export function injetarBiblioteca(prompt: string, slim: BibliotecaRefIA[]): string {
  const bloco = bibliotecaMarkdown(slim)
  if (prompt.includes(MARCADOR_BIBLIOTECA)) return prompt.split(MARCADOR_BIBLIOTECA).join(bloco)
  return `${prompt.trimEnd()}\n\n---\n\n## 📦 BIBLIOTECA DO PERSONAL\n\n${bloco}\n`
}

/** Prompt pronto para o personal: biblioteca no lugar do marcador e a instrução de entrega
 *  deste fluxo. Um prompt antigo em cache não tem `{{ENTREGA}}` — aí o replace é no-op e o
 *  texto que já estava escrito continua valendo, que é justamente o do fluxo manual. */
export function renderizarPromptIA(prompt: string, slim: BibliotecaRefIA[]): string {
  return injetarBiblioteca(prompt, slim).split(MARCADOR_ENTREGA).join(ENTREGA_MANUAL)
}

/** Monta um único arquivo .md = prompt (instruções) + seções de dados em blocos ```json```.
 *  O personal baixa e joga direto na IA — instruções e dados no mesmo arquivo. */
export function montarArquivoIA(prompt: string, secoes: SecaoDados[]): string {
  let out = prompt.trimEnd() + '\n'
  for (const s of secoes) {
    out += `\n---\n\n# ${s.titulo}\n\n`
    if (s.nota) out += `${s.nota}\n\n`
    out += '```json\n' + JSON.stringify(s.json, null, 2) + '\n```\n'
  }
  return out
}

/** Resultado de `limparJsonColado`: ou o JSON limpo, ou o motivo em português. */
export type JsonColado =
  | { ok: true; json: string }
  | { ok: false; erro: string }

/**
 * Limpa o que o personal colou antes de mandar ao servidor.
 *
 * A IA quase sempre imprime o JSON dentro de uma cerca ```json, e muitas vezes com uma frase
 * antes ("Aqui está o programa atualizado:") — colar a tela inteira é o caminho natural, e
 * qualquer um desses extras fazia o import falhar com "JSON inválido" sem dizer por quê.
 * Aqui a cerca e a prosa em volta são removidas, e o parse local dá o erro posicionado
 * imediatamente, sem ida ao servidor.
 */
export function limparJsonColado(texto: string): JsonColado {
  let s = texto.trim()
  if (!s) return { ok: false, erro: 'Cole o JSON gerado pela IA antes de continuar.' }

  // Cerca de markdown, com ou sem a linguagem: ```json … ```
  const cercado = s.match(/^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```$/)
  if (cercado) s = cercado[1].trim()

  // Prosa em volta: pega do primeiro { até o último } — a IA às vezes comenta antes/depois.
  if (!s.startsWith('{')) {
    const inicio = s.indexOf('{')
    const fim = s.lastIndexOf('}')
    if (inicio === -1 || fim <= inicio) {
      return {
        ok: false,
        erro: 'Não encontrei um bloco JSON no texto colado. Copie o bloco que começa com { e '
          + 'termina com }.',
      }
    }
    s = s.slice(inicio, fim + 1)
  }

  try {
    JSON.parse(s)
  } catch (e) {
    return {
      ok: false,
      erro: `O JSON colado está incompleto ou tem erro de sintaxe (${(e as Error).message}). `
        + 'Copie o bloco inteiro, do { inicial ao } final.',
    }
  }
  return { ok: true, json: s }
}

/** Baixa uma string como arquivo de texto (default: markdown). */
export function downloadText(content: string, filename: string, mime = 'text/markdown') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
