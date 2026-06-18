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

function ReadOnlyBubble({
  ator,
  texto,
  midias,
  dataHora,
  ctx,
}: {
  ator?: 'ALUNO' | 'PERSONAL'
  texto?: string
  midias?: FeedItem['midias']
  dataHora: string
  ctx: AvatarCtx
}) {
  if (!texto && !midias?.length) return null
  return (
    <div className="flex gap-2 mt-2">
      <div className="shrink-0 mt-0.5">
        <ItemAvatar ator={ator} ctx={ctx} />
      </div>
      <div className="max-w-[85%] rounded-xl rounded-tl-sm px-3 py-2 bg-white/5 border border-border space-y-0.5">
        {texto && <p className="text-xs text-text leading-snug whitespace-pre-wrap">{texto}</p>}
        <MediaGrid midias={midias ?? []} />
        <p className="text-[10px] text-text-muted">{fmtDt(dataHora)}</p>
      </div>
    </div>
  )
}

function threadProps(avatarCtx: AvatarCtx) {
  return {
    personalNome: avatarCtx.personalNome,
    personalFotoUrl: avatarCtx.personalFotoUrl ?? undefined,
    alunoNome: avatarCtx.alunoNome,
    alunoFotoUrl: avatarCtx.alunoFotoUrl ?? undefined,
  }
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
          descricao={item.descricao}
          descricaoAtor="ALUNO"
          descricaoMidias={item.midias}
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias, item.tipo)}
          {...threadProps(avatarCtx)}
        />
      ) : (
        <>
          <ReadOnlyBubble ator="ALUNO" texto={item.descricao} midias={item.midias} dataHora={item.data_hora} ctx={avatarCtx} />
          {item.respondido && item.resposta_texto && (
            <ReadOnlyBubble ator="PERSONAL" texto={item.resposta_texto} dataHora={item.respondido_em ?? item.data_hora} ctx={avatarCtx} />
          )}
        </>
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
      <div className="flex items-center gap-1.5">
        <Camera size={13} className="text-success shrink-0" />
        <span className="text-xs font-medium text-success">Execução · {autorLabel}</span>
        <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
      </div>
      {showThread ? (
        <ThreadRelato
          descricao={item.descricao}
          descricaoAtor={item.ator ?? 'ALUNO'}
          descricaoMidias={item.midias}
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias, item.tipo)}
          {...threadProps(avatarCtx)}
        />
      ) : (
        <ReadOnlyBubble ator={item.ator} texto={item.descricao} midias={item.midias} dataHora={item.data_hora} ctx={avatarCtx} />
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
  const descricao = item.descricao ?? item.texto

  return (
    <div className="rounded-lg p-2.5 space-y-1.5 bg-accent/10 border border-accent/20">
      <div className="flex items-center gap-1.5">
        <Wrench size={13} className="text-accent-hover shrink-0" />
        <span className="text-xs font-medium text-accent-hover">Correção do personal</span>
        <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
      </div>
      {showThread ? (
        <ThreadRelato
          descricao={descricao}
          descricaoAtor="PERSONAL"
          descricaoMidias={item.midias}
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias, item.tipo)}
          {...threadProps(avatarCtx)}
        />
      ) : (
        <ReadOnlyBubble ator="PERSONAL" texto={descricao} midias={item.midias} dataHora={item.data_hora} ctx={avatarCtx} />
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
      <div className="flex items-center gap-1.5">
        <MessageCircle size={13} className="text-text-secondary shrink-0" />
        <span className="text-xs font-medium text-text-secondary">Observação · {autorLabel}</span>
        <span className="text-[10px] text-text-muted ml-auto">{fmtDt(item.data_hora)}</span>
      </div>
      {showThread ? (
        <ThreadRelato
          descricao={item.descricao}
          descricaoAtor={item.ator ?? 'ALUNO'}
          descricaoMidias={item.midias}
          descricaoDataHora={item.data_hora}
          comentarios={item.comentarios}
          viewerAtor={viewerAtor!}
          uploadMidia={uploadMidia}
          onAddComentario={(texto, midias) => onAddComentario!(item.relato_sk!, texto, midias, item.tipo)}
          {...threadProps(avatarCtx)}
        />
      ) : (
        <ReadOnlyBubble ator={item.ator} texto={item.descricao} midias={item.midias} dataHora={item.data_hora} ctx={avatarCtx} />
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
