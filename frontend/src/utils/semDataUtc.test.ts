import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Trava de regressão: `toISOString()` devolve o dia UTC, nunca o dia do calendário.
 *
 * Foi este padrão exato que fez o compromisso das 21h cair no card do dia seguinte, o treino
 * que vence hoje aparecer como expirado e o formulário pré-preencher amanhã — três telas
 * diferentes, o mesmo erro. Use `diaLocal` / `diaNoFuso` (docs/TIMEZONE.md §10).
 *
 * Escape: `fuso-ok:` na mesma linha ou logo acima, com a justificativa escrita.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

// O módulo de data é quem implementa a conversão certa, e o teste dele documenta a errada
// de propósito — os dois precisam poder citar o padrão.
const LIBERADOS = ['utils/datetime.ts', 'utils/datetime.test.ts', 'utils/semDataUtc.test.ts']

const PROIBIDO = /toISOString\(\)\s*\.\s*(slice|substring|substr)\s*\(\s*0\s*,\s*10\s*\)/
const MARCADOR = 'fuso-ok:'

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

describe('nenhum dia de calendário sai de toISOString', () => {
  it('não há toISOString().slice(0, 10) no código', () => {
    const achados: string[] = []
    for (const caminho of arquivos(SRC)) {
      const rel = relative(SRC, caminho).replace(/\\/g, '/')
      if (LIBERADOS.includes(rel)) continue
      const linhas = readFileSync(caminho, 'utf8').split('\n')
      linhas.forEach((linha, i) => {
        // Comentário citando o padrão não conta — só código.
        const semComentario = linha.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
        if (!PROIBIDO.test(semComentario)) return
        const vizinhas = linhas.slice(Math.max(0, i - 2), i + 1)
        if (vizinhas.some((v) => v.includes(MARCADOR))) return
        achados.push(`${rel}:${i + 1}: ${linha.trim()}`)
      })
    }
    expect(achados, `\nDia UTC no lugar do dia local:\n${achados.join('\n')}\n`).toEqual([])
  })
})
