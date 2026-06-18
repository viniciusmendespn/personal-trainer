import { AlertTriangle, Camera, HelpCircle, MessageCircle, Wrench } from 'lucide-react'
import { ThreadRelato } from '../notificacoes/ThreadRelato'
import type { FeedItem } from '../../api/treinos'

type MidiaRef = { s3_key: string; tipo: string }
type UploadFn = (file: File) => Promise<MidiaRef>
type CommentFn = (relatoSk: string, texto: string | undefined, midias?: MidiaRef[]) => Promise<void>

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function RelatoItem({
  item,
  viewerAtor,
  onAddComentario,
  uploadMidia,
}: {
  item: FeedItem
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: CommentFn
  uploadMidia?: UploadFn
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
      <MediaGrid midias={item.midias ?? []} />
      {showThread ? (
        <ThreadRelato
          descricao={item.descricao}
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias)}
        />
      ) : (
        <>
          {item.descricao && <p className="text-xs text-text-secondary">{item.descricao}</p>}
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

function MediaGrid({ midias }: { midias: NonNullable<FeedItem['midias']> }) {
  if (!midias.length) return null
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {midias.map((m, i) =>
        m.url ? (
          m.tipo.startsWith('video') || m.tipo.includes('video') ? (
            <video key={i} src={m.url} controls className="rounded-lg max-h-40 max-w-[180px] border border-border" />
          ) : (
            <a key={i} href={m.url} target="_blank" rel="noreferrer">
              <img src={m.url} alt="mídia" className="rounded-lg max-h-40 max-w-[180px] border border-border object-cover" />
            </a>
          )
        ) : null,
      )}
    </div>
  )
}

function ExecucaoItem({
  item,
  viewerAtor,
  onAddComentario,
  uploadMidia,
}: {
  item: FeedItem
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: CommentFn
  uploadMidia?: UploadFn
}) {
  const showThread = !!viewerAtor && !!onAddComentario && !!item.relato_sk
  const autorLabel = item.ator === 'PERSONAL' ? 'Personal' : 'Aluno'

  return (
    <div className="rounded-lg p-2.5 space-y-1.5 bg-success/10 border border-success/20">
      <div className="flex items-center gap-1.5">
        <Camera size={13} className="text-success shrink-0" />
        <span className="text-xs font-medium text-success">Execução · {autorLabel}</span>
        <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
      </div>
      {item.descricao && <p className="text-xs text-text-secondary whitespace-pre-wrap">{item.descricao}</p>}
      <MediaGrid midias={item.midias ?? []} />
      {showThread && (
        <ThreadRelato
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias)}
        />
      )}
    </div>
  )
}

function CorrecaoItem({
  item,
  viewerAtor,
  onAddComentario,
  uploadMidia,
}: {
  item: FeedItem
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: CommentFn
  uploadMidia?: UploadFn
}) {
  const showThread = !!viewerAtor && !!onAddComentario && !!item.relato_sk

  return (
    <div className="rounded-lg p-2.5 space-y-1.5 bg-accent/10 border border-accent/20">
      <div className="flex items-center gap-1.5">
        <Wrench size={13} className="text-accent-hover shrink-0" />
        <span className="text-xs font-medium text-accent-hover">Correção do personal</span>
        <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
      </div>
      {item.descricao && <p className="text-xs text-text-secondary whitespace-pre-wrap">{item.descricao}</p>}
      {item.texto && !item.descricao && <p className="text-xs text-text-secondary whitespace-pre-wrap">{item.texto}</p>}
      <MediaGrid midias={item.midias ?? []} />
      {showThread && (
        <ThreadRelato
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias)}
        />
      )}
    </div>
  )
}

function OutroItem({
  item,
  viewerAtor,
  onAddComentario,
  uploadMidia,
}: {
  item: FeedItem
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: CommentFn
  uploadMidia?: UploadFn
}) {
  const showThread = !!viewerAtor && !!onAddComentario && !!item.relato_sk
  const autorLabel = item.ator === 'PERSONAL' ? 'Personal' : 'Aluno'

  return (
    <div className="rounded-lg p-2.5 space-y-1.5 bg-surface-elevated border border-border">
      <div className="flex items-center gap-1.5">
        <MessageCircle size={13} className="text-text-secondary shrink-0" />
        <span className="text-xs font-medium text-text-secondary">Observação · {autorLabel}</span>
        <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
      </div>
      {item.descricao && <p className="text-xs text-text-secondary whitespace-pre-wrap">{item.descricao}</p>}
      <MediaGrid midias={item.midias ?? []} />
      {showThread && (
        <ThreadRelato
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias)}
        />
      )}
    </div>
  )
}

interface Props {
  items: FeedItem[]
  emptyText?: string
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: CommentFn
  uploadMidia?: UploadFn
}

export function ExercicioFeedCard({ items, emptyText, viewerAtor, onAddComentario, uploadMidia }: Props) {
  if (!items.length) {
    if (emptyText) return <p className="text-xs text-text-muted py-1">{emptyText}</p>
    return null
  }
  return (
    <div className="space-y-2 mt-2">
      {items.map((item, i) => {
        const key = item.post_id ?? item.correcao_id ?? item.relato_sk ?? i
        const shared = { item, viewerAtor, onAddComentario, uploadMidia }
        if (item.tipo === 'CORRECAO') return <CorrecaoItem key={key} {...shared} />
        if (item.tipo === 'EXECUCAO') return <ExecucaoItem key={key} {...shared} />
        if (item.tipo === 'OUTRO') return <OutroItem key={key} {...shared} />
        return <RelatoItem key={key} {...shared} />
      })}
    </div>
  )
}
