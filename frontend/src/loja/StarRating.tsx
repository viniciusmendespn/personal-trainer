import { Star } from 'lucide-react'

export function StarRating({ media, count, size = 14 }: { media: number | null; count: number; size?: number }) {
  if (!count || media == null) {
    return <span className="text-xs text-text-muted">Sem avaliações</span>
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={size}
            className={i <= Math.round(media) ? 'text-warning fill-warning' : 'text-border'}
          />
        ))}
      </span>
      <span className="text-xs font-medium text-text">{media.toFixed(1)}</span>
      <span className="text-xs text-text-muted">({count})</span>
    </span>
  )
}

export function StarPicker({ value, onChange, size = 28 }: { value: number; onChange: (n: number) => void; size?: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} estrelas`}>
          <Star
            size={size}
            className={i <= value ? 'text-warning fill-warning' : 'text-border hover:text-warning/50'}
          />
        </button>
      ))}
    </div>
  )
}
