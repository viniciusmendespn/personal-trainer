import type { ExLib } from '../types'

/** Referência enxuta de um exercício da biblioteca, para dar de contexto à IA:
 *  nome EXATO (para casar por chave canônica no import) + grupo + vídeo. */
export interface BibliotecaRefIA {
  nome: string
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

/** Biblioteca enxuta e ordenada (grupo, depois nome) para embutir no arquivo da IA.
 *  Ignora exercícios ocultos (`ativo === false`) e zera URLs de busca. */
export function slimBiblioteca(lib: ExLib[]): BibliotecaRefIA[] {
  return lib
    .filter((e) => e.ativo !== false)
    .map((e) => ({
      nome: e.nome,
      grupo: e.grupo ?? null,
      video_url: ehBuscaYoutube(e.video_url) ? null : e.video_url ?? null,
    }))
    .sort(
      (a, b) =>
        (a.grupo ?? '').localeCompare(b.grupo ?? '', 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )
}

/** Biblioteca como lista markdown agrupada por grupo muscular — ~1 linha por exercício, contra
 *  as ~6 do JSON indentado. Numa biblioteca de 150 exercícios isso é a diferença entre ~900 e
 *  ~170 linhas no arquivo, o que decide se uma IA gratuita consegue ou não chegar até o fim. */
export function bibliotecaMarkdown(slim: BibliotecaRefIA[]): string {
  if (!slim.length) return '_(o personal ainda não cadastrou exercícios — monte tudo do zero)_'
  const porGrupo = new Map<string, BibliotecaRefIA[]>()
  for (const ex of slim) {
    const g = ex.grupo?.trim() || 'Sem grupo'
    const lista = porGrupo.get(g)
    if (lista) lista.push(ex)
    else porGrupo.set(g, [ex])
  }
  const linhas: string[] = []
  for (const [grupo, exs] of porGrupo) {
    linhas.push(`**${grupo}**`)
    for (const ex of exs) {
      linhas.push(`- ${ex.nome} → ${ex.video_url ?? '(sem vídeo cadastrado)'}`)
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

/** Substitui o marcador pela biblioteca renderizada. Se o prompt não tiver o marcador
 *  (versão antiga em cache do CloudFront), anexa no fim — nunca perde a biblioteca. */
export function injetarBiblioteca(prompt: string, slim: BibliotecaRefIA[]): string {
  const bloco = bibliotecaMarkdown(slim)
  if (prompt.includes(MARCADOR_BIBLIOTECA)) return prompt.split(MARCADOR_BIBLIOTECA).join(bloco)
  return `${prompt.trimEnd()}\n\n---\n\n## 📦 BIBLIOTECA DO PERSONAL\n\n${bloco}\n`
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
