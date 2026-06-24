import DOMPurify from 'dompurify'

export function RichTextContent({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: [],
  })

  if (!clean) return null

  return (
    <div
      className="rich-content text-sm text-text"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
