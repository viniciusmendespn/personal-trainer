import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link2, X as XIcon } from 'lucide-react'
import { feedGlobalApi, type PostGlobalItem } from '../../api/feedGlobal'
import { Input } from '../ui'

interface Props {
  value: string[]
  onChange: (v: string[]) => void
}

export function LinksUteisIncluirSelector({ value, onChange }: Props) {
  const { data: recursos } = useQuery({
    queryKey: ['feed-recursos'],
    queryFn: feedGlobalApi.recursos,
  })
  const [search, setSearch] = useState('')

  if (!recursos?.length) return null

  const selecionados: PostGlobalItem[] = recursos.filter((r) => value.includes(r.post_sk))
  const disponiveis: PostGlobalItem[] = recursos.filter(
    (r) =>
      !value.includes(r.post_sk) &&
      (search.trim() === '' || r.texto.toLowerCase().includes(search.trim().toLowerCase())),
  )

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-secondary flex items-center gap-1">
        <Link2 size={14} /> Links Úteis
      </p>
      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selecionados.map((r) => (
            <span
              key={r.post_sk}
              className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs px-2 py-1 rounded-full"
            >
              {r.texto.slice(0, 40)}
              {r.texto.length > 40 ? '…' : ''}
              <button
                type="button"
                onClick={() => onChange(value.filter((s) => s !== r.post_sk))}
                className="hover:text-danger"
              >
                <XIcon size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        placeholder="Buscar recurso educacional…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="text-xs"
      />
      {disponiveis.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
          {disponiveis.map((r) => (
            <button
              key={r.post_sk}
              type="button"
              onClick={() => onChange([...value, r.post_sk])}
              className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors flex items-center gap-2"
            >
              <Link2 size={10} className="shrink-0 text-accent" />
              {r.texto.slice(0, 60)}
              {r.texto.length > 60 ? '…' : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
