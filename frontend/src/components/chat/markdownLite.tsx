import type { ReactNode } from 'react'

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text))) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index))
    const token = m[0]
    if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-${i++}`} className="px-1 py-0.5 rounded bg-black/20 text-[0.85em] font-mono">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-${i++}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={`${keyPrefix}-${i++}`}>{token.slice(1, -1)}</em>)
    } else {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)
      if (link) {
        nodes.push(
          <a key={`${keyPrefix}-${i++}`} href={link[2]} target="_blank" rel="noreferrer" className="underline text-accent font-medium hover:opacity-80 transition-opacity">
            {link[1]}
          </a>
        )
      }
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

/** Markdown leve (bold/italic/code/links/listas) sem dependência externa nem
 * dangerouslySetInnerHTML — suficiente pro estilo de resposta curto do agente. */
export function renderMarkdownLite(text: string): ReactNode {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let listItems: string[] = []
  let listOrdered = false
  let inList = false

  function flushList() {
    if (!inList) return
    const items = listItems
    blocks.push(
      listOrdered ? (
        <ol key={`list-${blocks.length}`} className="list-decimal pl-5 my-1">
          {items.map((item, idx) => <li key={idx}>{renderInline(item, `li-${blocks.length}-${idx}`)}</li>)}
        </ol>
      ) : (
        <ul key={`list-${blocks.length}`} className="list-disc pl-5 my-1">
          {items.map((item, idx) => <li key={idx}>{renderInline(item, `li-${blocks.length}-${idx}`)}</li>)}
        </ul>
      )
    )
    listItems = []
    inList = false
  }

  lines.forEach((line, idx) => {
    const bulletMatch = /^\s*[-*]\s+(.*)/.exec(line)
    const numberedMatch = /^\s*\d+\.\s+(.*)/.exec(line)
    if (bulletMatch) {
      if (!inList || listOrdered) flushList()
      inList = true
      listOrdered = false
      listItems.push(bulletMatch[1])
    } else if (numberedMatch) {
      if (!inList || !listOrdered) flushList()
      inList = true
      listOrdered = true
      listItems.push(numberedMatch[1])
    } else {
      flushList()
      if (line.trim() === '') {
        if (idx < lines.length - 1) blocks.push(<br key={`br-${idx}`} />)
      } else {
        blocks.push(<span key={`p-${idx}`} className="block">{renderInline(line, `p-${idx}`)}</span>)
      }
    }
  })
  flushList()
  return <>{blocks}</>
}
