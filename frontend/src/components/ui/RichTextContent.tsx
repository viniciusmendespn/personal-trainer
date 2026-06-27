import DOMPurify from 'dompurify'

export function RichTextContent({ html, className }: { html: string; className?: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: [],
  })

  if (!clean) return null

  return (
    <div
      className={`rich-content text-sm text-text ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
