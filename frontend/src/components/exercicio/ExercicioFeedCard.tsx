import { AlertTriangle, HelpCircle, Wrench } from 'lucide-react'
import { ThreadRelato } from '../notificacoes/ThreadRelato'
import type { FeedItem } from '../../api/treinos'

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function RelatoItem({
  item,
  viewerAtor,
  onAddComentario,
}: {
  item: FeedItem
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: (relatoSk: string, texto: string) => Promise<void>
}) {
  const isDor = item.tipo === 'DOR'
  const showThread = !!viewerAtor && !!onAddComentario && !!item.relato_sk

  return (
    <div className={`rounded-lg p-2.5 space-y-1.5 ${isDor ? 'bg-danger/10 border border-danger/20' : 'bg-info/10 border border-info/20'}`}>
      <div className="flex items-center gap-1.5">
        {isDor
          ? <AlertTriangle size={13} className="text-danger shrink-0" />
          : <HelpCircle size={13} className="text-info shrink-0" />}
        <span className={`text-xs font-medium ${isDor ? 'text-danger' : 'text-info'}`}>
          {isDor ? 'Dor / desconforto' : 'Dúvida'}
        </span>
        <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
      </div>
      {showThread ? (
        <ThreadRelato
          descricao={item.descricao ?? ''}
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          onAddComentario={(texto) => onAddComentario!(item.relato_sk!, texto)}
        />
      ) : (
        <>
          <p className="text-xs text-text-secondary">{item.descricao}</p>
          {item.respondido && item.resposta_texto && (
            <div className="mt-1 pl-2 border-l-2 border-accent/40">
              <p className="text-[10px] text-text-muted mb-0.5">
                Personal respondeu{item.respondido_em && <span> · {fmtDt(item.respondido_em)}</span>}
              </p>
              <p className="text-xs text-text">{item.resposta_texto}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CorrecaoItem({ item }: { item: FeedItem }) {
  return (
    <div className="rounded-lg p-2.5 space-y-1.5 bg-accent/10 border border-accent/20">
      <div className="flex items-center gap-1.5">
        <Wrench size={13} className="text-accent-hover shrink-0" />
        <span className="text-xs font-medium text-accent-hover">Correção do personal</span>
        <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
      </div>
      {item.texto && <p className="text-xs text-text-secondary whitespace-pre-wrap">{item.texto}</p>}
      {!!item.midias?.length && (
        <div className="flex flex-wrap gap-2 pt-1">
          {item.midias.map((m, i) =>
            m.url ? (
              m.tipo.startsWith('video') || m.tipo.includes('video') ? (
                <video key={i} src={m.url} controls className="rounded-lg max-h-40 max-w-[180px] border border-border" />
              ) : (
                <a key={i} href={m.url} target="_blank" rel="noreferrer">
                  <img src={m.url} alt="correção" className="rounded-lg max-h-40 max-w-[180px] border border-border object-cover" />
                </a>
              )
            ) : null,
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  items: FeedItem[]
  emptyText?: string
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: (relatoSk: string, texto: string) => Promise<void>
}

export function ExercicioFeedCard({ items, emptyText, viewerAtor, onAddComentario }: Props) {
  if (!items.length) {
    if (emptyText) return <p className="text-xs text-text-muted py-1">{emptyText}</p>
    return null
  }
  return (
    <div className="space-y-2 mt-2">
      {items.map((item, i) =>
        item.tipo === 'CORRECAO'
          ? <CorrecaoItem key={item.correcao_id ?? i} item={item} />
          : <RelatoItem key={item.relato_sk ?? i} item={item} viewerAtor={viewerAtor} onAddComentario={onAddComentario} />,
      )}
    </div>
  )
}
