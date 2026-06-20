import type { ExLibCreate } from '../api/biblioteca'

export interface CsvParseResult {
  valid: ExLibCreate[]
  errors: string[]
}

export function parseCsvBiblioteca(text: string): CsvParseResult {
  const valid: ExLibCreate[] = []
  const errors: string[] = []

  if (!text.trim()) return { valid, errors }

  const lines = text.split('\n')
  let headerSkipped = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (!raw) continue

    const fields = parseCsvLine(raw)
    const firstName = fields[0]?.trim().toLowerCase()

    if (!headerSkipped && firstName === 'nome') {
      headerSkipped = true
      continue
    }

    const [nome = '', grupo = '', video_url = '', descricao = '', recomendacoes = ''] = fields
    const nomeTrimmed = nome.trim()

    if (!nomeTrimmed) {
      errors.push(`Linha ${i + 1}: campo "nome" vazio`)
      continue
    }

    valid.push({
      nome: nomeTrimmed,
      grupo: grupo.trim() || undefined,
      video_url: video_url.trim() || undefined,
      descricao: descricao.trim() || undefined,
      recomendacoes: recomendacoes.trim() || undefined,
    })
  }

  return { valid, errors }
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }

  fields.push(current)
  return fields
}
