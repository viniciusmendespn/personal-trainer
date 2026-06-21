import { useQuery } from '@tanstack/react-query'
import { BookOpen, EyeOff } from 'lucide-react'
import { feedGlobalApi, type PostGlobalItem } from '../../api/feedGlobal'
import type { ExLib } from '../../types'

interface Props {
  exercicioNome: string
  biblioteca: ExLib[]
  value: string[]       // post_sks excluídos da exibição
  onChange: (v: string[]) => void
}

export function LinksUteisSelector({ exercicioNome, biblioteca, value, onChange }: Props) {
  const { data: recursos } = useQuery({
    queryKey: ['feed-recursos'],
    queryFn: feedGlobalApi.recursos,
  })

  const libEntry = biblioteca.find(
    (b) => b.nome.toLowerCase() === exercicioNome.trim().toLowerCase(),
  )
  const libLinks: string[] = libEntry?.links_uteis ?? []

  if (!libLinks.length) return null

  const postsMap = new Map<string, PostGlobalItem>(
    (recursos ?? []).map((r) => [r.post_sk, r]),
  )

  const libPosts = libLinks.map((sk) => postsMap.get(sk)).filter(Boolean) as PostGlobalItem[]
  if (!libPosts.length) return null

  function toggle(sk: string) {
    onChange(
      value.includes(sk) ? value.filter((s) => s !== sk) : [...value, sk],
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-secondary flex items-center gap-1">
        <BookOpen size={14} /> Recursos da biblioteca
      </p>
      <div className="space-y-1">
        {libPosts.map((r) => {
          const excluido = value.includes(r.post_sk)
          return (
            <label
              key={r.post_sk}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                excluido ? 'opacity-40' : 'hover:bg-surface-elevated'
              }`}
            >
              <input
                type="checkbox"
                checked={!excluido}
                onChange={() => toggle(r.post_sk)}
                className="accent-accent shrink-0"
              />
              <span className="text-xs flex-1 truncate">
                {r.texto.slice(0, 60)}
                {r.texto.length > 60 ? '…' : ''}
              </span>
              {excluido && <EyeOff size={12} className="shrink-0 text-text-muted" />}
            </label>
          )
        })}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-text-muted">
          {value.length} recurso{value.length > 1 ? 's' : ''} oculto{value.length > 1 ? 's' : ''} para este aluno
        </p>
      )}
    </div>
  )
}
