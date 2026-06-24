import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Bold, Italic, Underline as UnderlineIcon, Heading2, List, ListOrdered } from 'lucide-react'

interface Props {
  label?: string
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({ label, value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      // Treat empty paragraph as empty string
      onChange(html === '<p></p>' ? '' : html)
    },
    editorProps: {
      attributes: {
        class: 'ProseMirror-content outline-none min-h-20 px-3 py-2 text-sm text-text',
        'data-placeholder': placeholder ?? '',
      },
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const current = editor.getHTML()
    const incoming = value || ''
    if (incoming !== current && !(incoming === '' && current === '<p></p>')) {
      editor.commands.setContent(incoming)
    }
  }, [value, editor])

  return (
    <div className="block">
      {label && (
        <span className="block text-xs font-medium text-text-secondary mb-1">{label}</span>
      )}
      <div className="rounded-lg border border-border bg-surface overflow-hidden transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-surface-elevated">
          <ToolbarBtn
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive('bold') ?? false}
            title="Negrito"
          >
            <Bold size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive('italic') ?? false}
            title="Itálico"
          >
            <Italic size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            active={editor?.isActive('underline') ?? false}
            title="Sublinhado"
          >
            <UnderlineIcon size={14} />
          </ToolbarBtn>
          <div className="w-px h-4 bg-border mx-1 shrink-0" />
          <ToolbarBtn
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor?.isActive('heading', { level: 2 }) ?? false}
            title="Título"
          >
            <Heading2 size={14} />
          </ToolbarBtn>
          <div className="w-px h-4 bg-border mx-1 shrink-0" />
          <ToolbarBtn
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            active={editor?.isActive('bulletList') ?? false}
            title="Lista"
          >
            <List size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            active={editor?.isActive('orderedList') ?? false}
            title="Lista numerada"
          >
            <ListOrdered size={14} />
          </ToolbarBtn>
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function ToolbarBtn({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'text-accent bg-accent/10'
          : 'text-text-secondary hover:text-text hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}
