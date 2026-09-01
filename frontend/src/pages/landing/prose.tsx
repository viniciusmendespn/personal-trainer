// Renderização de prosa das páginas públicas (blog e páginas SEO).
// Extraído de BlogPages.tsx para que os dois caminhos usem o MESMO parser —
// o equivalente em Node vive em scripts/prerender-public-pages.mjs (inline/renderTable).
// Mexeu aqui, mexa lá: é o par que diverge silenciosamente.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type ProseTableData = { headers: string[]; rows: string[][] }

// Converte links inline [texto](/caminho) em <Link>/<a>.
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const [, label, href] = match
    if (href.startsWith('http')) {
      // Link externo abre em aba nova: o leitor não perde o artigo ao instalar o app.
      nodes.push(<a key={match.index} href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#0f766e', fontWeight: 650 }}>{label}</a>)
    } else {
      nodes.push(<Link key={match.index} to={href} style={{ color: '#0f766e', fontWeight: 650 }}>{label}</Link>)
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function ProseList({ items }: { items: string[] }) {
  return (
    <ul style={{ color: '#475569', fontSize: 16, lineHeight: 1.8, paddingLeft: 24, marginBottom: 14, display: 'grid', gap: 6 }}>
      {items.map((item) => <li key={item}>{renderInline(item)}</li>)}
    </ul>
  )
}

// overflowX é obrigatório: sem ele o Googlebot mobile acusa conteúdo mais largo
// que a viewport, e a página inteira passa a rolar na horizontal no celular.
export function ProseTable({ table }: { table: ProseTableData }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14.5 }}>
        <thead>
          <tr>
            {table.headers.map((header) => (
              <th key={header} style={{ textAlign: 'left', padding: '10px 12px', background: '#f0fdfa', border: '1px solid #e2e8f0', color: '#0f172a', whiteSpace: 'nowrap' }}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '10px 12px', border: '1px solid #e2e8f0', color: '#475569' }}>{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
