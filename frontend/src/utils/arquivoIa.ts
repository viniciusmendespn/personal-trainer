import type { ExLib } from '../types'

/** Referência enxuta de um exercício da biblioteca, para dar de contexto à IA:
 *  nome EXATO (para casar por chave canônica no import) + grupo + vídeo. */
export interface BibliotecaRefIA {
  nome: string
  grupo: string | null
  video_url: string | null
}

/** Biblioteca enxuta e ordenada (grupo, depois nome) para embutir no arquivo da IA.
 *  Ignora exercícios ocultos (`ativo === false`). */
export function slimBiblioteca(lib: ExLib[]): BibliotecaRefIA[] {
  return lib
    .filter((e) => e.ativo !== false)
    .map((e) => ({ nome: e.nome, grupo: e.grupo ?? null, video_url: e.video_url ?? null }))
    .sort(
      (a, b) =>
        (a.grupo ?? '').localeCompare(b.grupo ?? '', 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )
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
