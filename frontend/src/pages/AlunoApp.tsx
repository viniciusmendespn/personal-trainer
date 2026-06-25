import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, TrendingUp, MessageCircle, History, Trophy, Check, ChevronRight, ChevronDown, Video, Timer, Clock, Bell, AlertTriangle, HelpCircle, Wrench, X, BarChart3, Search, Camera, Newspaper, Download, UserCircle, User, Flame, Medal, ArrowLeft, Info, Repeat, Zap } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { alunoApi, type ExSessao, type SessaoAtiva, type SessaoHistorico, type PostGlobal } from '../api/alunoApp'
import { usePushNotification } from '../hooks/usePushNotification'
import { SeriesPrescritasCompact } from '../components/exercicios/SeriesPrescritasEditor'
import { AlunoSessaoDetalheCard } from '../components/historico/SessaoDetalheCard'
import { alunoClient } from '../api/alunoClient'
import { FeedGlobalTab } from '../components/feed/FeedGlobalTab'
import { PontosWidget } from '../components/gamificacao/PontosWidget'
import { RankingList } from '../components/gamificacao/RankingList'
import { useAlunoChat, useSendAlunoChat, useSendDiretoAlunoChat } from '../hooks/useAlunoChat'
import { SplashScreen } from '../components/ui/SplashScreen'
import { useAlunoTimeline } from '../hooks/useAlunoTimeline'
import { ChatThread } from '../components/chat/ChatThread'
import { ChatInputBar } from '../components/chat/ChatInputBar'
import { ExercicioFeedCard } from '../components/exercicio/ExercicioFeedCard'
import { PostComposer } from '../components/exercicio/PostComposer'
import { Button, Card, Spinner, Input, Badge, StatCard, EmptyState, SearchableSelect, SocialLinks, useToast, useConfirm, Modal } from '../components/ui'
import { renderMarkdownLite } from '../components/chat/markdownLite'
import { AlunoPerfilModal } from '../components/aluno/AlunoPerfilModal'
import { alunoFinanceiroApi } from '../api/financeiro'
import { PixModal } from '../components/financeiro/PixModal'
import type { Cobranca, ExercicioSubstituto, SeriePrescrita } from '../types'
import { videoUrlComFallback } from '../utils/video'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: 'var(--color-text)',
  fontSize: 12,
}
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 12 }

function formatDiaCompleto(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === hoje.toDateString()) return 'hoje'
  if (d.toDateString() === ontem.toDateString()) return 'ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center text-text-secondary"
      style={{ background: 'var(--color-bg)' }}
    >
      <img src="/novo-logo-slogan-vertical-semfundo.png" alt="CoachPilot" style={{ width: 140, height: 'auto' }} />
      {children}
    </div>
  )
}

type AlunoSession = { aluno_id: string; personal_id: string; nome?: string } | null

function useAlunoSession() {
  const [session, setSession] = useState<AlunoSession>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const u = new URL(window.location.href)
      const code = u.searchParams.get('code')

      if (code) {
        window.history.replaceState({}, '', '/')
        try {
          await alunoClient.post('/v1/aluno/auth/redeem', { code })
        } catch {
          // code inválido ou expirado; tenta usar sessão existente
        }
      }

      try {
        const { data } = await alunoClient.get<AlunoSession>('/v1/aluno/auth/me')
        setSession(data)
      } catch {
        setSession(null)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  return { session, loading }
}

function NotifBell({ onNavigate, onOpenChat, onFinanceiro }: {
  onNavigate: (tab: 'evolucao' | 'historico' | 'feed', exId?: string) => void
  onOpenChat: () => void
  onFinanceiro: () => void
}) {
  const count = useQuery({
    queryKey: ['aluno-notif-count'],
    queryFn: alunoApi.notificacoesCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const [open, setOpen] = useState(false)
  const n = count.data?.nao_lidas ?? 0
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-1 text-text-muted hover:text-text transition-colors"
        aria-label="Notificações"
      >
        <Bell size={20} />
        {n > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-danger text-[10px] font-bold text-white flex items-center justify-center px-0.5">
            {n > 9 ? '9+' : n}
          </span>
        )}
      </button>
      {open && <NotifDrawer onClose={() => setOpen(false)} onNavigate={onNavigate} onOpenChat={onOpenChat} onFinanceiro={onFinanceiro} />}
    </>
  )
}

const ANOTIF_ICON: Record<string, React.ReactNode> = {
  DOR_RESPONDIDA: <AlertTriangle size={14} className="text-danger" />,
  DUVIDA_RESPONDIDA: <HelpCircle size={14} className="text-info" />,
  MSG_PERSONAL: <MessageCircle size={14} className="text-energy" />,
  CORRECAO_EXERCICIO: <Wrench size={14} className="text-accent-hover" />,
  MIDIA_PERSONAL: <Camera size={14} className="text-info" />,
  NOVO_POST_FEED: <Newspaper size={14} className="text-accent-hover" />,
  COBRANCA_VENCER: <Clock size={14} className="text-warning" />,
  COBRANCA_VENCIDA: <AlertTriangle size={14} className="text-danger" />,
}

const DEEP_LINK_TIPOS = ['DOR_RESPONDIDA', 'DUVIDA_RESPONDIDA', 'CORRECAO_EXERCICIO', 'MIDIA_PERSONAL']
const TAPPABLE_TIPOS = [...DEEP_LINK_TIPOS, 'MSG_PERSONAL', 'NOVO_POST_FEED', 'COBRANCA_VENCER', 'COBRANCA_VENCIDA']
const FINANCEIRO_TIPOS = ['COBRANCA_VENCER', 'COBRANCA_VENCIDA']

function NotifDrawer({ onClose, onNavigate, onOpenChat, onFinanceiro }: {
  onClose: () => void
  onNavigate: (tab: 'evolucao' | 'historico' | 'feed', exId?: string) => void
  onOpenChat: () => void
  onFinanceiro: () => void
}) {
  const qc = useQueryClient()
  const { isSubscribed, requestAndSubscribe } = usePushNotification()
  const pushSupported = 'Notification' in window && 'PushManager' in window
  const [permState, setPermState] = useState<NotificationPermission>(() =>
    pushSupported ? Notification.permission : 'denied'
  )
  const [notifLoading, setNotifLoading] = useState(false)
  const { show: showToast } = useToast()

  async function handleEnableNotif() {
    setNotifLoading(true)
    try {
      await requestAndSubscribe()
      const perm = pushSupported ? Notification.permission : 'denied'
      setPermState(perm)
      if (perm === 'granted') {
        showToast('Notificações ativadas com sucesso!', 'success')
      } else if (perm === 'denied') {
        showToast('Permissão negada. Verifique as configurações do iPhone.', 'error')
      }
    } finally {
      setNotifLoading(false)
    }
  }

  const notifs = useQuery({
    queryKey: ['aluno-notifs'],
    queryFn: () => alunoApi.notificacoes({ limit: 30 }),
  })
  const items = notifs.data?.items ?? []

  async function handleClick(n: typeof items[number]) {
    if (!n.lida) {
      await alunoApi.marcarNotificacaoLida(n.ref)
      qc.invalidateQueries({ queryKey: ['aluno-notifs'] })
      qc.invalidateQueries({ queryKey: ['aluno-notif-count'] })
    }
    if (n.tipo === 'MSG_PERSONAL') {
      onOpenChat()
      onClose()
    } else if (n.tipo === 'NOVO_POST_FEED') {
      onNavigate('feed')
      onClose()
    } else if (FINANCEIRO_TIPOS.includes(n.tipo)) {
      onFinanceiro()
      onClose()
    } else if (DEEP_LINK_TIPOS.includes(n.tipo) && n.exercicio_id) {
      onNavigate('evolucao', n.exercicio_id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="bg-surface-elevated rounded-t-2xl shadow-lg max-h-[70vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Notificações</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        {pushSupported && !isSubscribed && (
          <div className="px-4 py-3 border-b border-border">
            {permState === 'denied' ? (
              <p className="text-xs text-text-secondary">
                <strong className="text-text">Notificações bloqueadas.</strong>{' '}
                {/iphone|ipad|ipod/i.test(navigator.userAgent)
                  ? <>Vá em <strong className="text-text">Ajustes → Treinos → Notificações</strong> para habilitar.</>
                  : <>Clique no ícone de cadeado na barra de endereço do navegador e permita notificações.</>}
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <Bell size={16} className="text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text">Receba avisos em tempo real</p>
                  <p className="text-[11px] text-text-muted">Treinos, mensagens e lembretes</p>
                </div>
                <button
                  onClick={handleEnableNotif}
                  disabled={notifLoading}
                  className="shrink-0 text-xs font-semibold text-accent bg-accent/10 hover:bg-accent/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                >
                  {notifLoading && <span className="inline-block w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />}
                  {notifLoading ? 'Ativando…' : 'Ativar'}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {notifs.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
          {!notifs.isLoading && !items.length && (
            <p className="text-sm text-text-muted text-center py-8">Nenhuma notificação ainda.</p>
          )}
          {items.map((n) => (
            <button
              key={n.ref}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-white/5 ${n.lida ? 'opacity-60' : ''}`}
              onClick={() => handleClick(n)}
            >
              <div className="mt-0.5 shrink-0">{ANOTIF_ICON[n.tipo] ?? <Bell size={14} className="text-text-muted" />}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text leading-tight">{n.titulo}</p>
                <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.mensagem}</p>
                <p className="text-[10px] text-text-muted mt-1">{new Date(n.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                {TAPPABLE_TIPOS.includes(n.tipo) && (
                  <p className="text-[10px] text-accent-hover mt-0.5">Toque para ver</p>
                )}
              </div>
              {!n.lida && <span className="w-2 h-2 rounded-full bg-energy shrink-0 mt-1.5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const FAQ_ALUNO = [
  { q: 'Como inicio meu treino do dia?', a: 'Na aba Treino, você verá a lista de exercícios prescritos. Toque em "Iniciar Treino" para começar a sessão.' },
  { q: 'Como registro o peso e as repetições?', a: 'Com a sessão ativa, toque no exercício atual, preencha carga (kg) e repetições para cada série e toque em "Registrar". Repita para cada série.' },
  { q: 'O que é RPE e preciso preencher?', a: 'RPE é o índice de esforço percebido (0–10). 0–3 = muito fácil, 7–8 = difícil, 9–10 = máximo. É opcional, mas ajuda seu personal a ajustar as cargas.' },
  { q: 'Como vejo meu histórico de treinos?', a: 'Acesse a aba "Histórico" na barra inferior. Lá estão todas as suas sessões finalizadas com data, exercícios e séries.' },
  { q: 'Como funcionam os pontos?', a: 'Você ganha pontos por série (1pt), sessão finalizada (8pt), sessão 100% completa (+7pt), novo recorde/PR (10pt), post no feed (3pt) e meta atingida (50pt).' },
  { q: 'O que é o streak e o multiplicador?', a: 'Streak é o número de semanas seguidas em que você treinou. Com 3–8 semanas seus pontos dobram (2x); com 9+ semanas triplicam (3x). Se pular uma semana, o streak zera.' },
  { q: 'Como reporto uma dor para meu personal?', a: 'Durante a sessão ou pelo feed, toque em "Relatar Dor", selecione o exercício e descreva o que sentiu. Seu personal é notificado na hora.' },
  { q: 'Como envio uma foto ou vídeo da execução?', a: 'Toque no ícone de câmera durante a sessão ativa ou pelo feed. Grave ou fotografe e envie — aparece no feed e no histórico do exercício.' },
  { q: 'Como vejo minha evolução de cargas?', a: 'Acesse Evolução → aba "Carga", busque pelo nome do exercício. O gráfico mostra o peso levantado ao longo do tempo.' },
  { q: 'Como desbloquear badges (conquistas)?', a: 'As badges são automáticas: finalize sessões (1ª, 10ª, 25ª, 50ª, 100ª) ou mantenha streak (3, 8 e 12 semanas seguidas). Veja suas conquistas em Evolução → Conquistas.' },
  { q: 'Como ativo as notificações do app?', a: 'Quando o app perguntar "Deseja receber notificações?", toque em Permitir. Se não aparecer, acesse as configurações do seu navegador e permita notificações para o site.' },
  { q: 'Como falo com o assistente de IA?', a: 'Toque no ícone de chat (balão flutuante). Você pode perguntar sobre seu treino, registrar cargas pela conversa ou reportar dores. Para falar direto com o personal, toque em "Falar com personal".' },
]

function HelpModal({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="bg-surface-elevated rounded-t-2xl shadow-lg max-h-[80vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-accent-hover" />
            <h2 className="font-semibold text-sm">Ajuda</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {FAQ_ALUNO.map((item, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-start justify-between gap-3 px-3 py-3 text-left hover:bg-white/5 transition-colors"
              >
                <span className="text-xs font-medium text-text leading-snug">{item.q}</span>
                <ChevronDown size={14} className={`shrink-0 mt-0.5 text-text-muted transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-text-secondary leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-border shrink-0">
          <a
            href="/ajuda-aluno.md"
            download="coachpilot-guia-aluno.md"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent-hover text-xs font-medium transition-colors"
          >
            <Download size={14} />
            Baixar guia completo (.md) — para usar no ChatGPT
          </a>
          <p className="text-[10px] text-text-muted text-center mt-2">Baixe, abra o ChatGPT e arraste o arquivo junto com sua dúvida.</p>
        </div>
      </div>
    </div>
  )
}

class AlunoErrorBoundary extends React.Component<
  { children: React.ReactNode; onCrash: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch() { this.props.onCrash() }
  render() {
    if (this.state.hasError)
      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-center text-text-secondary">
          <div className="space-y-2">
            <p className="font-semibold text-text">Acesso desativado</p>
            <p className="text-sm">Seu acesso foi desativado pelo seu personal. Entre em contato para reativar.</p>
          </div>
        </div>
      )
    return this.props.children
  }
}

export function AlunoApp() {
  const { session, loading: sessionLoading } = useAlunoSession()
  const [disabled, setDisabled] = useState(false)
  const [profileConfirmed, setProfileConfirmed] = useState(false)
  const { isSubscribed, requestAndSubscribe } = usePushNotification()
  const [tab, setTab] = useState<'hoje' | 'evolucao' | 'historico' | 'feed' | 'personal'>('hoje')
  const [highlightExId, setHighlightExId] = useState<string | undefined>(undefined)
  const [chatOpen, setChatOpen] = useState(false)
  const [showRanking, setShowRanking] = useState(false)
  const installPromptRef = useRef<Event & { prompt: () => Promise<void> } | null>(null)
  const [showPerfilModal, setShowPerfilModal] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const [showIosModal, setShowIosModal] = useState(false)
  const [showAndroidModal, setShowAndroidModal] = useState(false)
  const me = useQuery({ queryKey: ['aluno-me'], queryFn: alunoApi.me, enabled: !!session, retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000 })

  useEffect(() => {
    const handler = () => setDisabled(true)
    window.addEventListener('pt:aluno:403', handler)
    return () => window.removeEventListener('pt:aluno:403', handler)
  }, [])

  useEffect(() => {
    if (me.isSuccess) setProfileConfirmed(true)
  }, [me.isSuccess])

  useEffect(() => {
    if (profileConfirmed && !isSubscribed) requestAndSubscribe()
  }, [profileConfirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      installPromptRef.current = e as Event & { prompt: () => Promise<void> }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleNotifNavigate(dest: 'evolucao' | 'historico' | 'feed', exId?: string) {
    setTab(dest)
    if (exId) setHighlightExId(exId)
  }

  if (sessionLoading) return <SplashScreen src="/novo-logo-slogan-vertical-semfundo.png" srcLight="/novo-logo-slogan-vertical-brancosemfundo.png" rounded={false} />
  if (!session) return (
    <Centered>
      <div className="space-y-2">
        <p className="font-semibold text-text">Acesso expirado</p>
        <p className="text-sm">Seu acesso expirou. Peça um novo link ao seu personal.</p>
      </div>
    </Centered>
  )
  if (disabled || me.isError) {
    const is403 = disabled || (me.error as { response?: { status?: number } })?.response?.status === 403
    return (
      <Centered>
        <div className="space-y-2">
          {is403 ? (
            <>
              <p className="font-semibold text-text">Acesso desativado</p>
              <p className="text-sm">Seu acesso foi desativado pelo seu personal. Entre em contato para reativar.</p>
            </>
          ) : (
            'Erro ao carregar seu perfil. Tente novamente mais tarde.'
          )}
        </div>
      </Centered>
    )
  }
  if (!profileConfirmed) return <SplashScreen src="/novo-logo-slogan-vertical-semfundo.png" srcLight="/novo-logo-slogan-vertical-brancosemfundo.png" rounded={false} />

  return (
    <AlunoErrorBoundary onCrash={() => setDisabled(true)}>
    <div
      className="min-h-screen max-w-md mx-auto flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <header className="px-4 pt-4 pb-2 shrink-0 flex items-center gap-2">
        <button
          onClick={() => setShowPerfilModal(true)}
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-accent shrink-0"
          aria-label="Editar meu perfil"
        >
          {me.data?.foto_url ? (
            <img src={me.data.foto_url} alt={me.data.nome ?? 'aluno'} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center">
              <User size={16} className="text-accent-hover" />
            </div>
          )}
        </button>
        <h1 className="font-display text-lg font-bold text-text truncate min-w-0 flex-1">Olá, {me.data?.nome ?? 'aluno'}</h1>
        <div className="flex items-center gap-1 shrink-0">
          {!isStandalone && (
            <button
              onClick={async () => {
                if (isIos) { setShowIosModal(true); return }
                if (installPromptRef.current) {
                  await installPromptRef.current.prompt()
                  return
                }
                setShowAndroidModal(true)
              }}
              className="relative p-1 text-text-muted hover:text-energy transition-colors"
              aria-label="Instalar app"
              title="Instalar app no celular"
            >
              <Download size={18} />
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-energy animate-pulse" />
            </button>
          )}
          <button
            onClick={() => setHelpOpen(true)}
            className="relative p-1 text-text-muted hover:text-text transition-colors"
            aria-label="Ajuda"
          >
            <HelpCircle size={20} />
          </button>
          <NotifBell onNavigate={handleNotifNavigate} onOpenChat={() => setChatOpen(true)} onFinanceiro={() => setTab('personal')} />
        </div>
      </header>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {tab === 'historico' ? (
        <main className="px-4 flex-1"><HistoricoTab /></main>
      ) : tab === 'feed' ? (
        <main className="px-4 flex-1 pt-2"><FeedGlobalTab /></main>
      ) : tab === 'evolucao' ? (
        <main className="px-4 flex-1"><Evolucao initialExId={highlightExId} /></main>
      ) : tab === 'personal' ? (
        <main className="px-4 flex-1 pt-2"><SobrePersonalTab /></main>
      ) : (
        <main className="px-4 flex-1">
          {showRanking ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowRanking(false)} className="text-text-muted hover:text-text transition-colors">
                  <X size={18} />
                </button>
                <h2 className="font-semibold text-sm flex items-center gap-2"><Trophy size={16} className="text-energy" />Ranking</h2>
              </div>
              <RankingList />
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <PontosWidget onVerRanking={() => setShowRanking(true)} />
              <StreakBanner />
              <Hoje onVerFeed={(exId) => handleNotifNavigate('evolucao', exId)} />
            </div>
          )}
        </main>
      )}

      {/* FAB — Chat */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed right-4 z-40 w-12 h-12 rounded-full bg-energy shadow-lg flex items-center justify-center text-black transition-transform hover:scale-105 active:scale-95"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        aria-label="Abrir chat"
      >
        <MessageCircle size={22} />
      </button>

      {/* Chat drawer */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <header className="shrink-0 h-14 flex items-center px-4 gap-3 border-b border-border bg-surface-elevated">
            <button onClick={() => setChatOpen(false)} className="text-text-secondary hover:text-text"><X size={20} /></button>
            <span className="text-sm font-medium text-text">Chat com o agente</span>
          </header>
          <ChatTab />
        </div>
      )}

      <AlunoPerfilModal
        isOpen={showPerfilModal}
        onClose={() => setShowPerfilModal(false)}
        nome={me.data?.nome}
        descricao={me.data?.descricao}
        foto_url={me.data?.foto_url}
      />

      <nav
        className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-surface-elevated/80 backdrop-blur-xl border-t border-border flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {([
          ['hoje', 'Treino', <Dumbbell size={18} />],
          ['evolucao', 'Evolução', <TrendingUp size={18} />],
          ['historico', 'Histórico', <History size={18} />],
          ['feed', 'Feed', <Newspaper size={18} />],
          ['personal', 'Personal', <UserCircle size={18} />],
        ] as const).map(
          ([k, label, icon]) => (
            <button key={k} onClick={() => { setTab(k as typeof tab); setShowRanking(false) }}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs transition-colors ${tab === k ? 'text-energy' : 'text-text-muted'}`}>
              {icon}{label}
            </button>
          ),
        )}
      </nav>
    </div>

    {showIosModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-2xl bg-surface-elevated border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-text">Instalar no iPhone</h3>
            <button onClick={() => setShowIosModal(false)} className="p-1 text-text-secondary hover:text-text">
              <X size={18} />
            </button>
          </div>
          <p className="text-xs bg-yellow-500/10 text-yellow-400 rounded-lg px-3 py-2">
            Abra esta página no <strong>Safari</strong> (não Chrome) para instalar
          </p>
          <ol className="space-y-4">
            <li className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span className="text-sm text-text-secondary">Toque em <strong className="text-text">⋯</strong> (três pontos) na barra de endereço do Safari</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span className="text-sm text-text-secondary">Toque em <strong className="text-text">"Compartilhar"</strong></span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span className="text-sm text-text-secondary">Role a lista e toque em <strong className="text-text">"Ver Mais"</strong></span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
              <span className="text-sm text-text-secondary">Selecione <strong className="text-text">"Adicionar à Tela de Início"</strong></span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">5</span>
              <span className="text-sm text-text-secondary">Toque em <strong className="text-text">Adicionar</strong> para confirmar</span>
            </li>
          </ol>
          <button onClick={() => setShowIosModal(false)} className="w-full py-2.5 rounded-lg bg-accent/20 text-accent-hover text-sm font-medium hover:bg-accent/30 transition-colors">Entendi</button>
        </div>
      </div>
    )}

    {showAndroidModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-2xl bg-surface-elevated border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-text">Instalar no Android</h3>
            <button onClick={() => setShowAndroidModal(false)} className="p-1 text-text-secondary hover:text-text">
              <X size={18} />
            </button>
          </div>
          <ol className="space-y-4">
            <li className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span className="text-sm text-text-secondary">No Chrome, toque em <strong className="text-text">⋮</strong> (três pontos) no canto superior direito</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span className="text-sm text-text-secondary">Selecione <strong className="text-text">"Adicionar à tela inicial"</strong> ou <strong className="text-text">"Instalar app"</strong></span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span className="text-sm text-text-secondary">Toque em <strong className="text-text">Adicionar</strong> para confirmar</span>
            </li>
          </ol>
          <button onClick={() => setShowAndroidModal(false)} className="w-full py-2.5 rounded-lg bg-accent/20 text-accent-hover text-sm font-medium hover:bg-accent/30 transition-colors">Entendi</button>
        </div>
      </div>
    )}

    </AlunoErrorBoundary>
  )
}

function ChatTab() {
  const { messages, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, agenteHabilitado } = useAlunoChat()
  const send = useSendAlunoChat()
  const sendDireto = useSendDiretoAlunoChat()
  const { show } = useToast()
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ChatThread
        messages={messages ?? []}
        isLoading={isLoading}
        isSending={send.isPending}
        viewerRole="ALUNO"
        agenteHabilitado={agenteHabilitado}
        onLoadMore={() => fetchNextPage()}
        hasMore={hasNextPage}
        isLoadingMore={isFetchingNextPage}
      />
      <ChatInputBar
        onSend={(text) => send.mutate(text)}
        onSendDireto={(text) => sendDireto.mutate(text, { onSuccess: () => show('Enviado direto pro seu personal.', 'success') })}
        disabled={send.isPending || sendDireto.isPending}
      />
    </div>
  )
}

function SobrePersonalTab() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['aluno-personal-profile'],
    queryFn: alunoApi.personalProfile,
    staleTime: 300_000,
  })
  const { data: me } = useQuery({ queryKey: ['aluno-me'], queryFn: alunoApi.me })

  if (isLoading) return <div className="flex justify-center pt-8"><Spinner /></div>

  return (
    <div className="space-y-4 pb-4">
      <Card className="flex flex-col items-center gap-3 py-6">
        {profile?.foto_url ? (
          <img
            src={profile.foto_url}
            alt={profile.nome ?? 'Personal'}
            className="w-20 h-20 rounded-full object-cover border-2 border-energy"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-accent/15 flex items-center justify-center">
            <User size={36} className="text-accent-hover" />
          </div>
        )}
        <div className="text-center">
          <p className="font-semibold text-text text-lg">{profile?.nome ?? '—'}</p>
          {profile?.descricao && <p className="text-sm text-text-secondary mt-0.5">{profile.descricao}</p>}
        </div>
        <SocialLinks
          instagramUrl={profile?.instagram_url}
          tiktokUrl={profile?.tiktok_url}
          youtubeUrl={profile?.youtube_url}
          linkedinUrl={profile?.linkedin_url}
          facebookUrl={profile?.facebook_url}
          xUrl={profile?.x_url}
          siteUrl={profile?.site_url}
        />
        {me?.nome && (
          <p className="text-xs text-text-muted">Seu personal trainer</p>
        )}
      </Card>

      {profile?.biografia && (
        <Card>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Sobre mim</p>
          <p className="text-sm text-text whitespace-pre-wrap">{profile.biografia}</p>
        </Card>
      )}
      {profile?.experiencia_profissional && (
        <Card>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Experiência profissional</p>
          <p className="text-sm text-text whitespace-pre-wrap">{profile.experiencia_profissional}</p>
        </Card>
      )}
      {profile?.formacao && (
        <Card>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Formação</p>
          <p className="text-sm text-text whitespace-pre-wrap">{profile.formacao}</p>
        </Card>
      )}
      {!profile?.biografia && !profile?.experiencia_profissional && !profile?.formacao && !isLoading && (
        <p className="text-sm text-text-muted text-center py-8">Seu personal ainda não preencheu o perfil completo.</p>
      )}
      <MensalidadeCard />
      <ConhecimentoTab />
    </div>
  )
}

function MensalidadeCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['aluno-financeiro'],
    queryFn: alunoFinanceiroApi.listCobrancas,
    staleTime: 60_000,
  })
  const { data: mpData } = useQuery({
    queryKey: ['aluno-mp-configurado'],
    queryFn: alunoFinanceiroApi.getMpConfigurado,
    staleTime: 5 * 60_000,
  })
  const [pixCobranca, setPixCobranca] = useState<Cobranca | null>(null)

  const cobranças = data?.items ?? []
  const pendentes = cobranças.filter((c) => c.status === 'PENDENTE' || c.status === 'VENCIDA')
  const ultima = cobranças[0]
  const mpConfigurado = mpData?.configurado ?? false

  if (isLoading || !ultima) return null

  function fmtValor(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
  function fmtData(iso: string) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  const STATUS_STYLE: Record<string, string> = {
    PAGA: 'text-success',
    PENDENTE: 'text-warning',
    VENCIDA: 'text-danger',
  }

  return (
    <>
      <Card className="space-y-2">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Mensalidade</p>
        {pendentes.length > 0 && (
          <div className="rounded-xl bg-warning/10 px-3 py-2 text-sm space-y-2">
            <div>
              <p className={`font-semibold ${pendentes[0].status === 'VENCIDA' ? 'text-danger' : 'text-warning'}`}>
                {pendentes[0].status === 'VENCIDA' ? 'Mensalidade vencida' : 'Pagamento pendente'}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {fmtValor(pendentes[0].valor)} · vence em {fmtData(pendentes[0].vencimento)}
              </p>
            </div>
            {mpConfigurado ? (
              <button
                onClick={() => setPixCobranca(pendentes[0])}
                className="w-full text-center text-xs font-semibold text-accent bg-accent/10 hover:bg-accent/20 rounded-lg py-1.5 transition-colors"
              >
                Pagar via Pix
              </button>
            ) : (
              <p className="text-xs text-text-muted">Fale com seu personal para mais informações.</p>
            )}
          </div>
        )}
        <div className="divide-y divide-border">
          {cobranças.slice(0, 5).map((c) => (
            <div key={c.cobranca_id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-text">{fmtValor(c.valor)}</p>
                <p className="text-xs text-text-muted">Vence: {fmtData(c.vencimento)}</p>
              </div>
              <span className={`text-xs font-medium ${STATUS_STYLE[c.status] ?? 'text-text-muted'}`}>
                {c.status === 'PAGA' ? 'Paga' : c.status === 'VENCIDA' ? 'Vencida' : 'Pendente'}
              </span>
            </div>
          ))}
        </div>
      </Card>
      {pixCobranca && (
        <PixModal cobranca={pixCobranca} onClose={() => setPixCobranca(null)} />
      )}
    </>
  )
}

function ConhecimentoTab() {
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)
  const { data: arquivos } = useQuery({ queryKey: ['aluno-conhecimento'], queryFn: alunoApi.conhecimentoList, retry: false })

  if (!arquivos?.length) return null

  async function baixar() {
    setDownloading(true)
    try {
      const { download_url } = await alunoApi.conhecimentoDownload()
      window.location.href = download_url
    } catch {
      toast.show('Não foi possível baixar o material agora. Tente novamente.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card className="space-y-2">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Base de conhecimento</p>
      <p className="text-sm text-text-secondary">
        Baixe todo o material que seu personal reuniu sobre treino e exercícios — vem com instruções
        pra você colar numa IA (ChatGPT etc.) e tirar dúvidas com base só nesses documentos.
      </p>
      <Button variant="outline" onClick={baixar} disabled={downloading} className="w-full">
        <span className="flex items-center justify-center gap-1.5">
          <Download size={16} /> {downloading ? 'Gerando…' : 'Baixar material (.zip)'}
        </span>
      </Button>
    </Card>
  )
}

function Hoje({ onVerFeed }: { onVerFeed: (exId: string) => void }) {
  const qc = useQueryClient()
  const sessao = useQuery({ queryKey: ['aluno-sessao'], queryFn: alunoApi.sessao, retry: false })
  const hoje = useQuery({ queryKey: ['aluno-hoje'], queryFn: alunoApi.hoje, retry: false })
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [substitutosPreview, setSubstitutosPreview] = useState<ExercicioSubstituto[] | null>(null)
  const previewExs = useQuery({
    queryKey: ['aluno-treino-preview', previewId],
    queryFn: () => alunoApi.exercicios(previewId!),
    enabled: !!previewId,
  })
  const start = useMutation({
    mutationFn: (id: string) => alunoApi.start(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-sessao'] })
      qc.invalidateQueries({ queryKey: ['aluno-sessao-exs'] })
    },
  })

  if (sessao.isLoading) return <Spinner />
  if (sessao.data?.sessao_id) return <SessaoTreino sessao={sessao.data} onVerFeed={onVerFeed} />

  const agendados = hoje.data?.hoje ?? []
  const lista = agendados.length ? agendados : (hoje.data?.treinos ?? []).map((t) => ({ id: t.treino_id, nome: t.nome }))
  const ultimo = hoje.data?.ultimo
  const proximo = hoje.data?.proximo

  if (previewId) {
    const nomeTreino = lista.find((t) => t.id === previewId)?.nome ?? 'Treino'
    const exs = previewExs.data ?? []
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewId(null)}
            className="p-1 -ml-1 text-text-muted hover:text-text transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-display font-semibold flex-1">{nomeTreino}</h2>
        </div>

        {substitutosPreview && (
          <SubstitutosModal substitutos={substitutosPreview} onClose={() => setSubstitutosPreview(null)} />
        )}
        {previewExs.isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <div className="space-y-2">
            {exs.map((ex, i) => (
              <Card key={ex.exercicio_id} variant="elevated" className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-xs font-medium text-text-muted mt-0.5 shrink-0">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{ex.nome}</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {ex.series_prescritas?.length
                          ? <SeriesPrescritasCompact items={ex.series_prescritas} />
                          : <>{ex.series ? `${ex.series}x` : ''}{ex.reps_prescritas ?? ''}{ex.carga_prescrita ? ` · ${ex.carga_prescrita}` : ''}</>
                        }
                      </p>
                      {ex.observacoes && (
                        <p className="text-xs text-text-muted mt-1 leading-snug">{ex.observacoes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(ex.substitutos_efetivos?.length ?? 0) > 0 && (
                      <button
                        onClick={() => setSubstitutosPreview(ex.substitutos_efetivos!)}
                        className="text-text-muted hover:text-energy transition-colors"
                        title="Ver alternativas"
                      >
                        <Repeat size={16} />
                      </button>
                    )}
                    <a
                      href={videoUrlComFallback(ex.nome, ex.video_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-muted hover:text-energy transition-colors"
                      title="Ver vídeo"
                    >
                      <Video size={16} />
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Button
          variant="energy"
          className="w-full"
          onClick={() => start.mutate(previewId)}
          disabled={start.isPending || previewExs.isLoading}
        >
          {start.isPending ? 'Iniciando…' : 'Iniciar Treino'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {(ultimo || proximo) && (
        <Card variant="elevated" className="space-y-1.5">
          {ultimo && (
            <p className="text-xs text-text-secondary">
              <span className="text-text-muted">Último treino:</span>{' '}
              <span className="font-medium text-text">{ultimo.treino_nome ?? '—'}</span>
              {ultimo.data && <span className="text-text-muted"> · {formatDiaCompleto(ultimo.data)}</span>}
            </p>
          )}
          {proximo && (
            <p className="text-xs text-text-secondary">
              <span className="text-text-muted">Próximo:</span>{' '}
              <span className="font-medium text-energy">{proximo.nome ?? '—'}</span>
            </p>
          )}
        </Card>
      )}

      <h2 className="font-display font-semibold">{agendados.length ? 'Treino de hoje' : 'Escolha um treino'}</h2>
      {!lista.length ? (
        <EmptyState icon={<Dumbbell />} title="Nenhum treino cadastrado ainda" />
      ) : (
        lista.map((t, idx) => (
          <Card key={t.id} variant="elevated" className="flex items-center justify-between">
            <span className="font-medium">
              <span className="text-text-muted">{idx + 1}. </span>
              {t.nome}
            </span>
            <Button variant="energy" onClick={() => setPreviewId(t.id)}>Ver treino</Button>
          </Card>
        ))
      )}
    </div>
  )
}

function StreakBanner() {
  const { data: pontos } = useQuery({ queryKey: ['aluno-pontos'], queryFn: alunoApi.pontos })
  const streak = pontos?.streak_atual ?? 0
  const mult = pontos?.multiplicador_atual ?? 1.0

  if (streak === 0) return null
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
      <Flame size={16} className="text-orange-400 shrink-0" />
      <p className="text-sm text-text flex-1">
        <span className="font-semibold text-orange-400">{streak} {streak === 1 ? 'semana' : 'semanas'} seguidas!</span>
        {mult > 1.0 && <span className="text-text-secondary"> Multiplicador de pontos: <span className="font-bold text-energy">×{mult.toFixed(1)}</span></span>}
      </p>
    </div>
  )
}

function ConquistasTab() {
  const { data: badges, isLoading } = useQuery({
    queryKey: ['aluno-badges'],
    queryFn: alunoApi.badges,
  })

  if (isLoading) return <div className="flex justify-center py-6"><Spinner /></div>
  if (!badges?.length) return <p className="text-text-muted text-sm py-4 text-center">Ainda não há conquistas definidas.</p>

  const unlocked = badges.filter((b) => b.unlocked)
  const locked = badges.filter((b) => !b.unlocked)

  return (
    <div className="space-y-4">
      {unlocked.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Desbloqueadas</p>
          <div className="grid grid-cols-3 gap-2">
            {unlocked.map((b) => (
              <div key={b.tipo} className="flex flex-col items-center gap-1 p-3 bg-surface-elevated rounded-xl border border-border/60">
                <span className="text-2xl">{b.emoji}</span>
                <p className="text-[11px] font-medium text-center leading-tight">{b.titulo}</p>
                <p className="text-[10px] text-text-muted text-center leading-tight">{b.descricao}</p>
                {b.unlocked_at && (
                  <p className="text-[9px] text-text-muted">{new Date(b.unlocked_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {locked.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Bloqueadas</p>
          <div className="grid grid-cols-3 gap-2">
            {locked.map((b) => (
              <div key={b.tipo} className="flex flex-col items-center gap-1 p-3 bg-surface rounded-xl border border-border opacity-50">
                <span className="text-2xl grayscale">❓</span>
                <p className="text-[11px] text-text-muted text-center leading-tight">{b.categoria}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {unlocked.length === 0 && locked.length === 0 && (
        <p className="text-text-muted text-sm py-4 text-center">Complete treinos e mantenha sua sequência para desbloquear conquistas!</p>
      )}
    </div>
  )
}

function formatElapsed(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function SessaoTreino({ sessao, onVerFeed }: { sessao: SessaoAtiva; onVerFeed: (exId: string) => void }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [elapsed, setElapsed] = useState(0)
  const ses = useQuery({ queryKey: ['aluno-sessao-exs'], queryFn: alunoApi.sessaoExercicios, retry: false })
  const finish = useMutation({
    mutationFn: () => alunoApi.finish(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-sessao'] })
      qc.invalidateQueries({ queryKey: ['aluno-sessao-exs'] })
      qc.invalidateQueries({ queryKey: ['aluno-sessoes'] })
    },
  })
  const cancel = useMutation({
    mutationFn: () => alunoApi.cancel(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-sessao'] })
      qc.invalidateQueries({ queryKey: ['aluno-sessao-exs'] })
    },
  })

  useEffect(() => {
    const inicio = new Date(sessao.data_hora_inicio).getTime()
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - inicio) / 1000)))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [sessao.data_hora_inicio])

  if (ses.isLoading || !ses.data) return <Spinner />
  const exs = ses.data.exercicios
  const feitos = exs.filter((e) => e.registrado?.length).length
  const progresso = exs.length ? Math.round((feitos / exs.length) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display font-semibold">{ses.data.treino_nome}</p>
        <span className="flex items-center gap-1 text-sm font-mono text-energy">
          <Timer size={14} />{formatElapsed(elapsed)}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{feitos}/{exs.length} exercícios feitos</span>
      </div>
      <div className="h-2 rounded-full bg-surface-elevated border border-border overflow-hidden">
        <div
          className="h-full bg-energy transition-all duration-300"
          style={{ width: `${progresso}%` }}
          role="progressbar"
          aria-valuenow={progresso}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="text-xs text-text-muted">Toque em um exercício para registrar — você pode começar por onde quiser e editar depois.</p>
      {exs.map((ex) => <ExercicioCard key={ex.exercicio_id} ex={ex} onVerFeed={onVerFeed} />)}
      <Button
        variant="energy"
        className="w-full"
        disabled={finish.isPending}
        onClick={async () => {
          const pendentes = exs.filter((e) => !e.registrado?.length)
          const ok = await confirm({
            title: 'Finalizar treino?',
            message: pendentes.length > 0 ? (
              <div className="space-y-2">
                <p>
                  {pendentes.length} exercício{pendentes.length > 1 ? 's' : ''} ainda não
                  {pendentes.length > 1 ? ' foram executados' : ' foi executado'}:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-text-muted">
                  {pendentes.map((e) => <li key={e.exercicio_id}>{e.nome}</li>)}
                </ul>
                <p>Deseja finalizar mesmo assim?</p>
              </div>
            ) : 'Confirma a finalização do treino?',
            confirmLabel: 'Finalizar',
            cancelLabel: 'Continuar treinando',
          })
          if (ok) finish.mutate()
        }}
      >
        {finish.isPending ? 'Finalizando…' : 'Finalizar treino'}
      </Button>
      <Button
        variant="outline" className="w-full" disabled={cancel.isPending}
        onClick={async () => {
          const ok = await confirm({
            title: 'Cancelar treino',
            message: 'Cancelar este treino? Nada do que você fez nessa sessão será registrado.',
            confirmLabel: 'Cancelar treino', cancelLabel: 'Voltar', tone: 'danger',
          })
          if (ok) cancel.mutate()
        }}
      >
        {cancel.isPending ? 'Cancelando…' : 'Cancelar treino'}
      </Button>
    </div>
  )
}

const sanitizeCarga = (v: string) => {
  const neg = v.startsWith('-')
  const digits = v.replace(/[^\d.,]/g, '')
  return neg ? '-' + digits : digits
}

function formatPr(val: number, tipo?: string): string {
  if (tipo === 'PESO_CORPORAL') return `${val} reps`
  if (tipo === 'CARDIO') return String(val)
  return `${val} kg`
}

function RecursosModal({ recursos, onClose }: { recursos: PostGlobal[]; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Recursos educacionais" size="lg">
      <div className="space-y-4">
        {recursos.map((r) => (
          <div key={r.post_sk} className="space-y-2">
            <div className="text-sm text-text-primary leading-relaxed">{renderMarkdownLite(r.texto)}</div>
            {r.midias?.length > 0 && (
              <div className="grid grid-cols-3 gap-1">
                {r.midias.map((m, i) =>
                  m.tipo?.includes('video') ? (
                    <video key={i} src={m.url} controls className="col-span-3 rounded-xl w-full max-h-56 object-cover" />
                  ) : m.tipo?.includes('audio') ? (
                    <audio key={i} src={m.url} controls className="col-span-3 w-full rounded-xl" />
                  ) : (
                    <img key={i} src={m.url} alt="" className="rounded-xl w-full aspect-square object-cover" />
                  )
                )}
              </div>
            )}
            {recursos.length > 1 && <hr className="border-border" />}
          </div>
        ))}
      </div>
    </Modal>
  )
}

function SubstitutoOpcao({
  nome, series_prescritas, video_url, observacao, selecionado, interativo, onClick,
}: {
  nome: string
  series_prescritas?: SeriePrescrita[]
  video_url?: string
  observacao?: string
  selecionado: boolean
  interativo: boolean
  onClick?: () => void
}) {
  const conteudo = (
    <div className="space-y-1">
      <p className={`text-sm font-medium ${selecionado && interativo ? 'text-accent' : ''}`}>
        {nome}{selecionado && interativo ? ' ✓' : ''}
      </p>
      {series_prescritas?.length ? <div><SeriesPrescritasCompact items={series_prescritas} /></div> : null}
      <a href={videoUrlComFallback(nome, video_url)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-accent-hover hover:underline">
        <Video size={12} /> Ver vídeo de execução
      </a>
      {observacao && <p className="text-xs text-text-secondary whitespace-pre-wrap">{observacao}</p>}
    </div>
  )
  if (!interativo) return <div className="pb-3 border-b border-border last:border-0 last:pb-0">{conteudo}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-2 rounded-lg border transition-colors ${selecionado ? 'border-accent bg-accent/5' : 'border-border hover:bg-surface-elevated'}`}
    >
      {conteudo}
    </button>
  )
}

function SubstitutosModal({
  substitutos, onClose, original, ativo, onEscolher,
}: {
  substitutos: ExercicioSubstituto[]
  onClose: () => void
  original?: { nome: string; series_prescritas?: SeriePrescrita[]; video_url?: string; observacao?: string }
  ativo?: string | null
  onEscolher?: (item: ExercicioSubstituto | null) => void
}) {
  const interativo = !!onEscolher
  return (
    <Modal open onClose={onClose} title={interativo ? 'Escolher exercício' : 'Alternativas para este exercício'} size="lg">
      <div className="space-y-2">
        {original && (
          <SubstitutoOpcao
            nome={original.nome}
            series_prescritas={original.series_prescritas}
            video_url={original.video_url}
            observacao={original.observacao}
            selecionado={!ativo}
            interativo={interativo}
            onClick={() => { onEscolher?.(null); onClose() }}
          />
        )}
        {substitutos.map((s) => (
          <SubstitutoOpcao
            key={s.nome}
            nome={s.nome}
            series_prescritas={s.series_prescritas}
            video_url={s.video_url}
            observacao={s.observacao}
            selecionado={ativo === s.nome}
            interativo={interativo}
            onClick={() => { onEscolher?.(s); onClose() }}
          />
        ))}
      </div>
    </Modal>
  )
}

function ExercicioCard({ ex, onVerFeed }: { ex: ExSessao; onVerFeed: (exId: string) => void }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [recursosOpen, setRecursosOpen] = useState(false)
  const [substitutosOpen, setSubstitutosOpen] = useState(false)
  const [pr, setPr] = useState<number | null>(null)
  const [variante, setVariante] = useState<ExercicioSubstituto | null>(
    () => ex.substitutos_efetivos?.find((s) => s.nome === ex.substituto_executado) ?? null
  )
  const feito = !!ex.registrado?.length
  const temRecursos = (ex.recursos?.length ?? 0) > 0
  const temSubstitutos = (ex.substitutos_efetivos?.length ?? 0) > 0
  const nomeAtivo = variante?.nome ?? ex.nome
  const videoAtivo = videoUrlComFallback(nomeAtivo, variante?.video_url ?? ex.video_url)
  const obsAtiva = variante?.observacao ?? ex.observacoes
  const seriesAtivas = variante?.series_prescritas?.length ? variante.series_prescritas : ex.series_prescritas

  const buildRows = (v: ExercicioSubstituto | null) => {
    const variantNome = v?.nome ?? null
    const registradoNome = ex.substituto_executado ?? null
    if (ex.registrado?.length && variantNome === registradoNome) {
      return ex.registrado.map((s) => ({ carga: s.carga ?? '', reps: s.reps != null ? String(s.reps) : '', repsHint: '', cargaHint: '' }))
    }
    const prescritas = v?.series_prescritas?.length ? v.series_prescritas : ex.series_prescritas
    if (prescritas?.length) {
      return prescritas.flatMap((p) =>
        Array.from({ length: p.series }, () => ({ carga: '', reps: '', repsHint: p.reps ? String(p.reps) : '', cargaHint: p.carga ? String(p.carga) : '' }))
      )
    }
    return Array.from({ length: ex.series ?? 1 }, () => ({ carga: '', reps: '', repsHint: '', cargaHint: ex.carga_prescrita ?? '' }))
  }
  const [rows, setRows] = useState(() => buildRows(variante))
  const upd = (i: number, f: 'carga' | 'reps', v: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [f]: v } : r)))
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i))
  const { show } = useToast()

  function escolherVariante(item: ExercicioSubstituto | null) {
    setVariante(item)
    setRows(buildRows(item))
    setPr(null)
  }

  const tipo = ex.tipo_exercicio ?? 'FORCA'

  const ultimaExec = useQuery({
    queryKey: ['aluno-hist-ex', ex.nome],
    queryFn: () => alunoApi.historicoExercicio(ex.nome),
    enabled: open,
    staleTime: 10 * 60_000,
  })

  const save = useMutation({
    mutationFn: () => {
      if (tipo === 'PESO_CORPORAL') {
        if (rows.some((r) => !r.reps)) throw new Error('Preencha as repetições de todas as séries.')
      } else if (tipo === 'CARDIO') {
        if (rows.some((r) => !r.reps)) throw new Error('Preencha a duração de todos os blocos.')
      } else {
        if (rows.some((r) => !r.reps)) throw new Error('Preencha as repetições de todas as séries.')
      }
      const series = rows.map((r) => ({
        carga: tipo === 'PESO_CORPORAL' ? undefined : (r.carga || undefined),
        reps: Number(r.reps),
      }))
      return alunoApi.registrar(series, ex.exercicio_id, variante?.nome)
    },
    onError: (e: Error) => show(e.message, 'error'),
    onSuccess: (r) => {
      if (r.pr_novo) setPr(r.pr_novo)
      qc.invalidateQueries({ queryKey: ['aluno-sessao-exs'] })
      qc.invalidateQueries({ queryKey: ['aluno-resumo'] })
      setOpen(false)
    },
  })

  return (
    <Card variant="elevated">
      {recursosOpen && temRecursos && (
        <RecursosModal recursos={ex.recursos!} onClose={() => setRecursosOpen(false)} />
      )}
      {substitutosOpen && temSubstitutos && (
        <SubstitutosModal
          substitutos={ex.substitutos_efetivos!}
          original={{ nome: ex.nome, series_prescritas: ex.series_prescritas, video_url: ex.video_url, observacao: ex.observacoes }}
          ativo={variante?.nome ?? null}
          onEscolher={escolherVariante}
          onClose={() => setSubstitutosOpen(false)}
        />
      )}
      <div className="flex items-center gap-1">
        <button className="flex-1 flex items-center justify-between text-left min-w-0"
          onClick={() => { if (!open) { setRows(buildRows(variante)); setPr(null) } setOpen((o) => !o) }}>
          <span className="min-w-0">
            <span className="font-medium block truncate">
              {nomeAtivo}
              {variante && <span className="ml-1.5 text-[10px] text-accent align-middle">substituto</span>}
            </span>
            <span className="block mt-0.5">
              {seriesAtivas?.length
                ? <SeriesPrescritasCompact items={seriesAtivas} tipoExercicio={ex.tipo_exercicio} />
                : <span className="text-xs text-text-muted">{ex.series ? `${ex.series}x` : ''}{ex.reps_prescritas ?? ''}{ex.carga_prescrita ? ` · ${ex.carga_prescrita}` : ''}</span>
              }
            </span>
          </span>
          {feito ? <Check size={16} className="text-success shrink-0" /> : <ChevronRight size={16} className="text-text-muted shrink-0" />}
        </button>
        {temSubstitutos && (
          <button
            onClick={() => setSubstitutosOpen(true)}
            aria-label="Trocar exercício"
            className="shrink-0 text-accent hover:text-accent-hover transition-colors p-1"
          >
            <Repeat size={15} />
          </button>
        )}
        {temRecursos && (
          <button
            onClick={() => setRecursosOpen(true)}
            aria-label="Ver recursos educacionais"
            className="shrink-0 text-accent hover:text-accent-hover transition-colors p-1"
          >
            <Info size={15} />
          </button>
        )}
        <button
          onClick={() => onVerFeed(ex.exercicio_id)}
          aria-label="Ver feed do exercício"
          className="shrink-0 text-accent hover:text-accent-hover transition-colors p-1"
        >
          <MessageCircle size={15} />
        </button>
      </div>

      {(videoAtivo || obsAtiva) && (
        <div className="mt-2 space-y-1">
          {videoAtivo && (
            <a href={videoAtivo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-hover hover:underline">
              <Video size={12} /> Ver vídeo de execução
            </a>
          )}
          {obsAtiva && (
            <p className="text-xs text-text-secondary bg-white/5 rounded-lg px-2 py-1.5 whitespace-pre-wrap">{obsAtiva}</p>
          )}
        </div>
      )}

      {feito && !open && (
        <p className="text-xs text-text-secondary mt-1">
          {ex.registrado!.map((s) => {
            if (tipo === 'PESO_CORPORAL') return `${s.reps ?? '-'} reps`
            if (tipo === 'CARDIO') return `${s.reps ?? '-'}${s.carga ? ` · RPE ${s.carga}` : ''}`
            const cargaLabel = s.carga ? ` · ${s.carga} ${ex.unidade_carga ?? 'kg'}` : ''
            return `${s.reps ?? '-'} ${ex.unidade_reps ?? 'reps'}${cargaLabel}`
          }).join('   ')}
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          {/* F1 — última execução histórica como referência */}
          {ultimaExec.data?.[0] && (
            <p className="text-xs text-text-muted">
              Última vez ({new Date(ultimaExec.data[0].data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}){': '}
              {ultimaExec.data[0].series_exec.map((s) => {
                if (tipo === 'PESO_CORPORAL') return `${s.reps ?? '-'} ${ex.unidade_reps ?? 'reps'}`
                if (tipo === 'CARDIO') return `${s.reps ?? '-'}${s.carga ? ` · RPE ${s.carga}` : ''}`
                const cargaLabel = s.carga ? ` · ${s.carga} ${ex.unidade_carga ?? 'kg'}` : ''
                return `${s.reps ?? '-'} ${ex.unidade_reps ?? 'reps'}${cargaLabel}`
              }).join('   ')}
            </p>
          )}

          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-xs text-text-muted w-12">
                {tipo === 'CARDIO' ? `Bloco ${i + 1}` : `Sér ${i + 1}`}
              </span>
              {/* F3 — reps antes de carga */}
              <div className="relative flex-1">
                <Input
                  className={tipo === 'CARDIO' ? 'pr-16' : 'pr-10'}
                  inputMode="decimal"
                  placeholder={r.repsHint || '0'}
                  value={r.reps}
                  onChange={(e) => upd(i, 'reps', e.target.value.replace(/[^\d.]/g, ''))}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">
                  {tipo === 'CARDIO' ? 'dur/dist' : (ex.unidade_reps ?? 'reps')}
                </span>
              </div>
              {tipo !== 'PESO_CORPORAL' && (
                <div className="relative flex-1">
                  <Input
                    className={tipo === 'CARDIO' ? 'pr-12' : 'pr-7'}
                    inputMode={tipo === 'CARDIO' ? 'text' : 'decimal'}
                    placeholder={r.cargaHint || (tipo === 'CARDIO' ? '7' : '0')}
                    value={r.carga}
                    onChange={(e) => upd(i, 'carga', tipo === 'CARDIO' ? e.target.value.replace(/[^\d.]/g, '') : sanitizeCarga(e.target.value))}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">
                    {tipo === 'CARDIO' ? 'RPE' : (ex.unidade_carga ?? 'kg')}
                  </span>
                </div>
              )}
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} aria-label="Remover série" className="text-text-muted hover:text-danger">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setRows([...rows, { carga: '', reps: '', repsHint: '', cargaHint: '' }])}
            className="text-xs text-accent-hover"
          >
            {tipo === 'CARDIO' ? '+ bloco' : '+ série'}
          </button>
          {pr != null && (
            <Badge tone="warning" className="text-xs">
              <Trophy size={12} /> Novo recorde: {formatPr(pr, tipo)}!
            </Badge>
          )}
          <Button variant="energy" className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : feito ? 'Atualizar' : 'Registrar'}
          </Button>

          <PostComposer exercicioId={ex.exercicio_id} exercicioNome={nomeAtivo} viewerAtor="ALUNO" />
        </div>
      )}
    </Card>
  )
}

function formatDuracao(secs?: number) {
  if (!secs) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  if (m > 0) return `${m}min ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

function groupSessoesByPeriodo(sessions: SessaoHistorico[]) {
  const groups: { label: string; items: typeof sessions }[] = []
  for (const s of sessions) {
    const d = new Date(s.data_hora_inicio)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    let label: string
    if (diffDays <= 6) label = 'Esta semana'
    else if (diffDays <= 13) label = 'Semana passada'
    else {
      const mes = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      label = mes.charAt(0).toUpperCase() + mes.slice(1)
    }
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(s)
    else groups.push({ label, items: [s] })
  }
  return groups
}

function HistoricoTab() {
  const { sessions, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAlunoTimeline()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (!sessions.length)
    return <EmptyState icon={<History />} title="Nenhum treino finalizado ainda" description="Complete seu primeiro treino para ver o histórico." />

  const groups = groupSessoesByPeriodo(sessions)

  return (
    <div className="space-y-4 pb-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{g.label}</p>
          <div className="space-y-2">
            {g.items.map((s) => {
              const expanded = expandedId === s.sessao_id
              const totalSeries = (s.exercicios_exec ?? []).reduce((acc, e) => acc + (e.series_exec?.length ?? 0), 0)
              return (
                <Card key={s.sessao_id} variant="elevated">
                  <button
                    className="w-full flex items-start justify-between text-left gap-2"
                    onClick={() => setExpandedId(expanded ? null : s.sessao_id)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.treino_nome}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {new Date(s.data_hora_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {s.duracao_segundos ? <> · <Clock size={10} className="inline mb-0.5" /> {formatDuracao(s.duracao_segundos)}</> : null}
                        {s.total_ex ? ` · ${s.total_ex} exercício${s.total_ex !== 1 ? 's' : ''}` : null}
                        {totalSeries ? ` · ${totalSeries} séries` : null}
                      </p>
                    </div>
                    {expanded ? <ChevronDown size={16} className="shrink-0 text-text-muted mt-0.5" /> : <ChevronRight size={16} className="shrink-0 text-text-muted mt-0.5" />}
                  </button>

                  {expanded && (
                    <AlunoSessaoDetalheCard sessaoId={s.sessao_id} />
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      ))}
      {hasNextPage && (
        <Button variant="outline" className="w-full" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? <Spinner /> : 'Carregar mais'}
        </Button>
      )}
    </div>
  )
}

type AbaEvolucao = 'carga' | 'volume' | 'recordes' | 'feed' | 'conquistas'

const ABA_EVOLUCAO: { key: AbaEvolucao; label: string; icon: React.ReactNode }[] = [
  { key: 'feed', label: 'Feed', icon: <MessageCircle size={13} /> },
  { key: 'carga', label: 'Carga', icon: <TrendingUp size={13} /> },
  { key: 'volume', label: 'Volume', icon: <BarChart3 size={13} /> },
  { key: 'recordes', label: 'Recordes', icon: <Trophy size={13} /> },
  { key: 'conquistas', label: 'Conquistas', icon: <Medal size={13} /> },
]

function Evolucao({ initialExId }: { initialExId?: string }) {
  const qc = useQueryClient()
  const { show } = useToast()
  const resumo = useQuery({ queryKey: ['aluno-resumo'], queryFn: alunoApi.resumo })
  const exs = useQuery({ queryKey: ['aluno-exs'], queryFn: alunoApi.listExercicios })
  const me = useQuery({ queryKey: ['aluno-me'], queryFn: alunoApi.me })
  const personal = useQuery({ queryKey: ['aluno-personal-profile'], queryFn: alunoApi.personalProfile, staleTime: 300_000 })
  const [exId, setExId] = useState(initialExId ?? '')
  const [aba, setAba] = useState<AbaEvolucao>('feed')
  const [prQuery, setPrQuery] = useState('')
  const [prLimit, setPrLimit] = useState(12)
  const exsOptions = useMemo(
    () => (exs.data ?? []).map((e) => ({ value: e.exercicio_id, label: e.nome })),
    [exs.data]
  )

  useEffect(() => {
    if (initialExId) { setExId(initialExId); setAba('feed'); return }
    if (!exId && exs.data?.length) setExId(exs.data[0].exercicio_id)
  }, [exs.data, exId, initialExId])

  const evo = useQuery({ queryKey: ['aluno-evo', exId], queryFn: () => alunoApi.evolucao(exId), enabled: !!exId && aba === 'carga' })
  const feed = useQuery({ queryKey: ['aluno-feed', exId], queryFn: () => alunoApi.feedExercicio(exId), enabled: !!exId && aba === 'feed' })

  const exSel = exs.data?.find((e) => e.exercicio_id === exId)
  const tipoEvo = (evo.data?.tipo ?? exSel?.tipo_exercicio ?? 'FORCA') as string

  const chartData = (evo.data?.serie ?? [])
    .filter((p) => {
      if (tipoEvo === 'PESO_CORPORAL') return p.reps_max != null
      if (tipoEvo === 'CARDIO') return (p.duracao_total_s ?? 0) > 0
      return p.carga_max != null
    })
    .map((p) => ({
      data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      carga: tipoEvo === 'PESO_CORPORAL' ? p.reps_max : tipoEvo === 'CARDIO' ? p.duracao_total_s : p.carga_max,
    }))

  const pontosIrm = tipoEvo === 'FORCA'
    ? (evo.data?.serie ?? [])
        .filter((p) => p.irm != null)
        .map((p) => ({
          data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          irm: p.irm as number,
        }))
    : []

  const semanas = useMemo(
    () => (resumo.data?.semanas ?? []).map((w) => ({ semana: w.semana.replace(/^\d+-/, ''), volume: w.volume })),
    [resumo.data]
  )

  const prsFiltrados = useMemo(
    () => (resumo.data?.prs ?? []).filter((p) => p.exercicio.toLowerCase().includes(prQuery.toLowerCase())),
    [resumo.data, prQuery]
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Sessões" value={resumo.data?.total_sessoes ?? 0} tone="accent" />
        <StatCard label="Esta semana" value={resumo.data?.sessoes_semana ?? 0} tone="success" />
      </div>

      {/* Abas */}
      <div
        className="flex gap-1 border-b border-border overflow-x-auto"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {ABA_EVOLUCAO.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-t-lg border-b-2 transition-colors ${
              aba === a.key
                ? 'border-accent text-accent-hover bg-accent/5'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* Aba Carga */}
      {aba === 'carga' && (
        !exs.data?.length ? (
          <p className="text-text-muted text-sm">Sem exercícios ainda.</p>
        ) : (
          <>
            <SearchableSelect
              options={exsOptions}
              value={exId}
              onChange={setExId}
              placeholder="Buscar exercício…"
            />
            {!chartData.length ? (
              <p className="text-text-muted text-sm">
                {tipoEvo === 'PESO_CORPORAL' ? 'Sem registros de reps ainda.' : tipoEvo === 'CARDIO' ? 'Sem registros ainda.' : 'Sem registros com carga ainda.'}
              </p>
            ) : (
              <>
                <Card variant="elevated">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-text-secondary">
                      {tipoEvo === 'PESO_CORPORAL' ? 'Máx. reps por sessão' : tipoEvo === 'CARDIO' ? 'Métrica por sessão' : 'Carga por sessão'}
                    </span>
                    <Badge tone="warning">
                      <Trophy size={12} />
                      {' '}
                      {evo.data?.pr?.carga != null
                        ? tipoEvo === 'PESO_CORPORAL' ? `${evo.data.pr.carga} reps` : tipoEvo === 'CARDIO' ? String(evo.data.pr.carga) : `${evo.data.pr.carga} ${exSel?.unidade_carga ?? 'kg'}`
                        : '—'}
                    </Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                      <defs>
                        <linearGradient id="alunoCargaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-energy)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="var(--color-energy)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="data" tick={axisTick} stroke="var(--color-border-strong)" />
                      <YAxis
                        tick={axisTick}
                        stroke="var(--color-border-strong)"
                      />
                      <Tooltip
                        contentStyle={chartTip}
                        formatter={(v: number) => [
                          tipoEvo === 'PESO_CORPORAL' ? `${v} reps` : tipoEvo === 'CARDIO' ? String(v) : `${v} ${exSel?.unidade_carga ?? 'kg'}`,
                          tipoEvo === 'PESO_CORPORAL' ? 'Reps' : tipoEvo === 'CARDIO' ? 'Valor' : (exSel?.unidade_carga ?? 'kg'),
                        ]}
                      />
                      <Area type="monotone" dataKey="carga" stroke="var(--color-energy)" strokeWidth={2.5}
                        fill="url(#alunoCargaGradient)" dot={{ r: 3, fill: 'var(--color-energy)' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
                {pontosIrm.length > 0 && (
                  <Card variant="elevated" className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-text-secondary flex items-center gap-1.5">
                        <Zap size={14} className="text-energy" /> IRM — Intensidade Relativa Média
                      </span>
                      <Badge tone="neutral">
                        último: {pontosIrm.at(-1)?.irm.toFixed(1)}%
                      </Badge>
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                      <AreaChart data={pontosIrm} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                        <defs>
                          <linearGradient id="alunoIrmGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="data" tick={axisTick} stroke="var(--color-border-strong)" />
                        <YAxis
                          domain={['auto', 'auto']}
                          tick={axisTick}
                          stroke="var(--color-border-strong)"
                          tickFormatter={(v: number) => `${v}%`}
                          width={42}
                        />
                        <Tooltip
                          contentStyle={chartTip}
                          formatter={(v: number) => [`${v.toFixed(1)}%`, 'IRM']}
                        />
                        <Area type="monotone" dataKey="irm" stroke="var(--color-accent)" strokeWidth={2.5}
                          fill="url(#alunoIrmGradient)" dot={{ r: 3, fill: 'var(--color-accent)' }} name="IRM (%)" />
                      </AreaChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-text-muted mt-2">
                      Intensidade média ponderada pelas repetições em relação ao 1RM.
                    </p>
                  </Card>
                )}
              </>
            )}
          </>
        )
      )}

      {/* Aba Volume */}
      {aba === 'volume' && (
        !semanas.length ? (
          <p className="text-text-muted text-sm">Sem dados de volume ainda.</p>
        ) : (
          <Card variant="elevated">
            <p className="text-sm text-text-secondary mb-3">Volume por semana (kg)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={semanas} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="semana" tick={axisTick} stroke="var(--color-border-strong)" />
                <YAxis tick={axisTick} stroke="var(--color-border-strong)" />
                <Tooltip contentStyle={chartTip} />
                <Bar dataKey="volume" fill="var(--color-accent)" radius={[6, 6, 0, 0]} name="Volume (kg)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )
      )}

      {/* Aba Recordes */}
      {aba === 'recordes' && (
        !(resumo.data?.prs?.length) ? (
          <p className="text-text-muted text-sm">Nenhum recorde ainda.</p>
        ) : (
          <Card variant="elevated">
            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <Input placeholder="Buscar exercício…" value={prQuery} onChange={(e) => setPrQuery(e.target.value)} className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-2">
              {prsFiltrados.slice(0, prLimit).map((p) => {
                const exPr = exs.data?.find((e) => e.nome === p.exercicio)
                const tipoPr = exPr?.tipo_exercicio ?? 'FORCA'
                const valorPr = tipoPr === 'PESO_CORPORAL'
                  ? `${p.carga} reps`
                  : tipoPr === 'CARDIO'
                    ? String(p.carga)
                    : `${p.carga} ${exPr?.unidade_carga ?? 'kg'}`
                return (
                  <Badge key={p.exercicio} tone="warning">{p.exercicio}: <b className="ml-1">{valorPr}</b><span className="ml-1 text-xs opacity-70">{new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span></Badge>
                )
              })}
            </div>
            {prsFiltrados.length > prLimit && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPrLimit((n) => n + 12)}>
                Carregar mais ({prsFiltrados.length - prLimit} restantes)
              </Button>
            )}
          </Card>
        )
      )}

      {/* Aba Conquistas */}
      {aba === 'conquistas' && <ConquistasTab />}

      {/* Aba Feed */}
      {aba === 'feed' && (
        !exs.data?.length ? (
          <p className="text-text-muted text-sm">Sem exercícios ainda.</p>
        ) : (
          <div className="space-y-3">
            <SearchableSelect
              options={exsOptions}
              value={exId}
              onChange={setExId}
              placeholder="Buscar exercício…"
            />
            {!!exId && (
              <PostComposer
                exercicioId={exId}
                exercicioNome={exs.data?.find((e) => e.exercicio_id === exId)?.nome}
                viewerAtor="ALUNO"
              />
            )}
            <ExercicioFeedCard
              items={feed.data ?? []}
              emptyText="Nenhuma postagem ainda. Use o botão acima para postar."
              viewerAtor="ALUNO"
              alunoNome={me.data?.nome}
              alunoFotoUrl={me.data?.foto_url}
              personalNome={personal.data?.nome}
              personalFotoUrl={personal.data?.foto_url}
              uploadMidia={async (file) => {
                const { upload_url, s3_key } = await alunoApi.midiaUploadUrl(file.name, file.type)
                await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
                return { s3_key, tipo: file.type.startsWith('video') ? 'video_execucao' : 'foto_exercicio' }
              }}
              onAddComentario={async (relatoSk, texto, midias, postTipo) => {
                try {
                  if (relatoSk.startsWith('POST#')) {
                    await alunoApi.comentarPost({ post_sk: relatoSk, texto, midias, post_tipo: postTipo })
                  } else {
                    await alunoApi.comentarRelato({ relato_sk: relatoSk, texto, midias })
                  }
                  qc.invalidateQueries({ queryKey: ['aluno-feed', exId] })
                } catch {
                  show('Não foi possível enviar o comentário.', 'error')
                }
              }}
            />
          </div>
        )
      )}
    </div>
  )
}
