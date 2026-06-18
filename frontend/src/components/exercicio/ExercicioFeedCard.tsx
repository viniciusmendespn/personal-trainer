import { AlertTriangle, Camera, HelpCircle, MessageCircle, Wrench } from 'lucide-react'
import { ThreadRelato } from '../notificacoes/ThreadRelato'
import { Avatar } from '../ui'
import type { FeedItem } from '../../api/treinos'

type MidiaRef = { s3_key: string; tipo: string }
type UploadFn = (file: File) => Promise<MidiaRef>
type CommentFn = (relatoSk: string, texto: string | undefined, midias?: MidiaRef[], postTipo?: string) => Promise<void>

interface AvatarCtx {
  alunoNome?: string
  alunoFotoUrl?: string | null
  personalNome?: string
  personalFotoUrl?: string | null
}

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function ItemAvatar({ ator, ctx }: { ator?: 'ALUNO' | 'PERSONAL'; ctx: AvatarCtx }) {
  const isPersonal = ator === 'PERSONAL'
  return (
    <Avatar
      name={isPersonal ? (ctx.personalNome ?? 'P') : (ctx.alunoNome ?? 'A')}
      imageUrl={isPersonal ? ctx.personalFotoUrl : ctx.alunoFotoUrl}
      size="sm"
    />
  )
}

function RelatoItem({
  item,
  viewerAtor,
  onAddComentario,
  uploadMidia,
  avatarCtx,
}: {
  item: FeedItem
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: CommentFn
  uploadMidia?: UploadFn
  avatarCtx: AvatarCtx
}) {
  const isDor = item.tipo === 'DOR'
  const showThread = !!viewerAtor && !!onAddComentario && !!item.relato_sk

  return (
    <div className={`rounded-lg p-2.5 space-y-1.5 ${isDor ? 'bg-danger/10 border border-danger/20' : 'bg-info/10 border border-info/20'}`}>
      <div className="flex items-center gap-2">
        <ItemAvatar ator="ALUNO" ctx={avatarCtx} />
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {isDor
            ? <AlertTriangle size={13} className="text-danger shrink-0" />
            : <HelpCircle size={13} className="text-info shrink-0" />}
          <span className={`text-xs font-medium ${isDor ? 'text-danger' : 'text-info'}`}>
            {isDor ? 'Dor / desconforto' : 'Dúvida'}
          </span>
          <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
        </div>
      </div>
      <MediaGrid midias={item.midias ?? []} />
      {showThread ? (
        <ThreadRelato
          descricao={item.descricao}
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias, item.tipo)}
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
  avatarCtx,
}: {
  item: FeedItem
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: CommentFn
  uploadMidia?: UploadFn
  avatarCtx: AvatarCtx
}) {
  const showThread = !!viewerAtor && !!onAddComentario && !!item.relato_sk
  const autorLabel = item.ator === 'PERSONAL' ? 'Personal' : 'Aluno'

  return (
    <div className="rounded-lg p-2.5 space-y-1.5 bg-success/10 border border-success/20">
      <div className="flex items-center gap-2">
        <ItemAvatar ator={item.ator} ctx={avatarCtx} />
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Camera size={13} className="text-success shrink-0" />
          <span className="text-xs font-medium text-success">Execução · {autorLabel}</span>
          <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
        </div>
      </div>
      {item.descricao && <p className="text-xs text-text-secondary whitespace-pre-wrap">{item.descricao}</p>}
      <MediaGrid midias={item.midias ?? []} />
      {showThread && (
        <ThreadRelato
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias, item.tipo)}
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
  avatarCtx,
}: {
  item: FeedItem
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: CommentFn
  uploadMidia?: UploadFn
  avatarCtx: AvatarCtx
}) {
  const showThread = !!viewerAtor && !!onAddComentario && !!item.relato_sk

  return (
    <div className="rounded-lg p-2.5 space-y-1.5 bg-accent/10 border border-accent/20">
      <div className="flex items-center gap-2">
        <ItemAvatar ator="PERSONAL" ctx={avatarCtx} />
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Wrench size={13} className="text-accent-hover shrink-0" />
          <span className="text-xs font-medium text-accent-hover">Correção do personal</span>
          <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
        </div>
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
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias, item.tipo)}
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
  avatarCtx,
}: {
  item: FeedItem
  viewerAtor?: 'ALUNO' | 'PERSONAL'
  onAddComentario?: CommentFn
  uploadMidia?: UploadFn
  avatarCtx: AvatarCtx
}) {
  const showThread = !!viewerAtor && !!onAddComentario && !!item.relato_sk
  const autorLabel = item.ator === 'PERSONAL' ? 'Personal' : 'Aluno'

  return (
    <div className="rounded-lg p-2.5 space-y-1.5 bg-surface-elevated border border-border">
      <div className="flex items-center gap-2">
        <ItemAvatar ator={item.ator} ctx={avatarCtx} />
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <MessageCircle size={13} className="text-text-secondary shrink-0" />
          <span className="text-xs font-medium text-text-secondary">Observação · {autorLabel}</span>
          <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
        </div>
      </div>
      {item.descricao && <p className="text-xs text-text-secondary whitespace-pre-wrap">{item.descricao}</p>}
      <MediaGrid midias={item.midias ?? []} />
      {showThread && (
        <ThreadRelato
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias, item.tipo)}
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
  alunoNome?: string
  alunoFotoUrl?: string | null
  personalNome?: string
  personalFotoUrl?: string | null
}

export function ExercicioFeedCard({ items, emptyText, viewerAtor, onAddComentario, uploadMidia, alunoNome, alunoFotoUrl, personalNome, personalFotoUrl }: Props) {
  if (!items.length) {
    if (emptyText) return <p className="text-xs text-text-muted py-1">{emptyText}</p>
    return null
  }
  const avatarCtx: AvatarCtx = { alunoNome, alunoFotoUrl, personalNome, personalFotoUrl }
  return (
    <div className="space-y-2 mt-2">
      {items.map((item, i) => {
        const key = item.post_id ?? item.correcao_id ?? item.relato_sk ?? i
        const shared = { item, viewerAtor, onAddComentario, uploadMidia, avatarCtx }
        if (item.tipo === 'CORRECAO') return <CorrecaoItem key={key} {...shared} />
        if (item.tipo === 'EXECUCAO') return <ExecucaoItem key={key} {...shared} />
        if (item.tipo === 'OUTRO') return <OutroItem key={key} {...shared} />
        return <RelatoItem key={key} {...shared} />
      })}
    </div>
  )
}
