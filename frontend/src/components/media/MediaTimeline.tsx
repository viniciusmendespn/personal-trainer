import { useState } from 'react'
import { Camera, User, UserCog } from 'lucide-react'
import { Card, Modal, Spinner } from '../ui'

export interface MediaTimelineItem {
  midia_id: string
  tipo: string
  url?: string
  data_hora: string
  ator?: 'ALUNO' | 'PERSONAL'
}

function groupByDate(items: MediaTimelineItem[]) {
  const groups: { data: string; items: MediaTimelineItem[] }[] = []
  for (const item of items) {
    const data = new Date(item.data_hora).toLocaleDateString('pt-BR')
    const last = groups[groups.length - 1]
    if (last?.data === data) last.items.push(item)
    else groups.push({ data, items: [item] })
  }
  return groups
}

function Gallery({ items, onSelect }: { items: MediaTimelineItem[]; onSelect: (i: MediaTimelineItem) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <button key={item.midia_id} onClick={() => onSelect(item)} className="shrink-0 relative">
          {item.tipo.includes('video') ? (
            <video src={item.url} className="w-20 h-20 object-cover rounded-lg border border-border" />
          ) : (
            <img src={item.url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" />
          )}
          <span
            className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border border-border ${item.ator === 'PERSONAL' ? 'bg-accent/20' : 'bg-surface-elevated'}`}
            title={item.ator === 'PERSONAL' ? 'Correção do personal' : 'Execução do aluno'}
          >
            {item.ator === 'PERSONAL' ? <UserCog size={10} className="text-accent" /> : <User size={10} />}
          </span>
        </button>
      ))}
    </div>
  )
}

export function MediaTimeline({ items, isLoading, compact }: { items: MediaTimelineItem[]; isLoading?: boolean; compact?: boolean }) {
  const [lightbox, setLightbox] = useState<MediaTimelineItem | null>(null)

  if (isLoading) return <div className="flex justify-center py-4"><Spinner /></div>
  if (!items.length) return null

  const sorted = [...items].sort((a, b) => b.data_hora.localeCompare(a.data_hora))
  const groups = groupByDate(sorted)

  const inner = (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.data}>
          {!compact && <p className="text-xs text-text-muted mb-1">{g.data}</p>}
          <Gallery items={g.items} onSelect={setLightbox} />
        </div>
      ))}
    </div>
  )

  return (
    <>
      {compact ? inner : (
        <Card variant="elevated">
          <p className="text-sm text-text-secondary mb-3 flex items-center gap-1">
            <Camera size={14} /> Fotos e vídeos
          </p>
          {inner}
        </Card>
      )}
      <Modal open={!!lightbox} onClose={() => setLightbox(null)} title={lightbox?.ator === 'PERSONAL' ? 'Correção do personal' : 'Execução do aluno'}>
        {lightbox && (
          lightbox.tipo.includes('video') ? (
            <video src={lightbox.url} controls className="w-full rounded-lg" />
          ) : (
            <img src={lightbox.url} alt="" className="w-full rounded-lg" />
          )
        )}
      </Modal>
    </>
  )
}
