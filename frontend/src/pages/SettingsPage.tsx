import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QrCode, Phone, CheckCircle, AlertCircle, WifiOff, RefreshCw, Copy, Smartphone, Banknote, Trash2, Info, Sun, Moon, Monitor } from 'lucide-react'
import { wapiApi } from '../api/wapi'
import { financeiroApi } from '../api/financeiro'
import { personalApi } from '../api/personal'
import { pushPersonalApi } from '../api/push'
import { usePushPersonal } from '../hooks/usePushPersonal'
import { Button, Card, ErrorText, Tabs } from '../components/ui'
import { useToast, useConfirm } from '../components/ui'
import { PhoneInput } from '../components/PhoneInput'
import { AnamneseEditor } from '../components/anamnese/AnamneseEditor'
import { ConexoesTab } from '../components/settings/ConexoesTab'
import { usePlanoStatus } from '../hooks/usePlano'
import { useTheme, type ThemeChoice } from '../context/ThemeContext'
import { fusoDoAparelho } from '../utils/datetime'

type TabId = 'whatsapp' | 'anamnese' | 'pagamentos' | 'notificacoes' | 'conexoes' | 'regiao' | 'aparencia'

const TABS: { id: TabId; label: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'anamnese', label: 'Anamnese' },
  { id: 'pagamentos', label: 'Pagamentos' },
  { id: 'notificacoes', label: 'Notificações' },
  { id: 'conexoes', label: 'Conexões' },
  { id: 'regiao', label: 'Região' },
  { id: 'aparencia', label: 'Aparência' },
]

type Method = 'qr' | 'pairing'

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^55/, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return raw
}

function getErrMsg(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string }; status?: number }; message?: string }
  if (e?.response?.data?.detail) return e.response.data.detail
  if (e?.response?.status === 502) return 'Erro ao comunicar com W-API.'
  return e?.message || 'Erro desconhecido'
}

function WhatsAppTab() {
  const qc = useQueryClient()
  const { show: toast } = useToast()
  const [method, setMethod] = useState<Method>('qr')
  const [pairingPhone, setPairingPhone] = useState('')
  const { data: plano } = usePlanoStatus()
  const addonAtivo = plano?.addon_whatsapp_ativo ?? false

  const status = useQuery({
    queryKey: ['wapi-status'],
    queryFn: wapiApi.status,
    retry: false,
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false
      if (!query.state.data?.configured) return false
      if (query.state.data?.connected) return false
      return 5000
    },
  })

  const noInstance = status.isSuccess && !status.data?.configured
  const connected = status.data?.connected === true

  const deviceInfo = useQuery({
    queryKey: ['wapi-device-info'],
    queryFn: wapiApi.deviceInfo,
    enabled: connected,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const qrQuery = useQuery({
    queryKey: ['wapi-qr'],
    queryFn: wapiApi.qr,
    enabled: false,
    retry: false,
  })

  const pairingQuery = useQuery({
    queryKey: ['wapi-pairing', pairingPhone],
    queryFn: () => wapiApi.pairingCode(pairingPhone),
    enabled: false,
    retry: false,
  })

  const disconnectMut = useMutation({
    mutationFn: wapiApi.disconnect,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wapi-status'] })
      qc.removeQueries({ queryKey: ['wapi-device-info'] })
      toast('Desconectado com sucesso')
    },
  })

  useEffect(() => {
    if (method === 'qr' && !connected && status.isSuccess && status.data?.configured) {
      const t = setTimeout(() => qrQuery.refetch(), 1500)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, noInstance, connected, status.isLoading])

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Conecte seu número para enviar lembretes automáticos e receber as mensagens dos seus alunos.
      </p>

      {!addonAtivo && (
        <Card variant="elevated" className="border-accent/30">
          <p className="text-sm text-text-secondary">
            Canal WhatsApp é um add-on opcional — em breve disponível para contratação.
            Acompanhe novidades em <span className="text-accent-hover">Plano</span>.
          </p>
        </Card>
      )}

      {/* Status bar */}
      {!noInstance && (
        <Card variant="elevated">
          <div className="flex items-center gap-3">
            {connected
              ? <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              : <WifiOff className="w-5 h-5 text-text-secondary flex-shrink-0" />}
            <div className="flex-1">
              <p className={`font-semibold text-sm ${connected ? 'text-success' : 'text-text-secondary'}`}>
                {connected ? 'WhatsApp Conectado' : 'Aguardando conexão...'}
              </p>
              {connected && status.data?.phone && (
                <p className="text-xs text-text-secondary">{status.data.phone}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {connected && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnectMut.mutate()}
                  disabled={disconnectMut.isPending}
                >
                  Desconectar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Atualizar status"
                onClick={() => status.refetch()}
              >
                <RefreshCw size={16} className={status.isFetching ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Painel de conexão */}
      {!noInstance && !connected && (
        <Card variant="elevated">
          <div className="flex gap-2 mb-5">
            {(['qr', 'pairing'] as Method[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  method === m
                    ? 'bg-accent text-white'
                    : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                {m === 'qr' ? <QrCode className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                {m === 'qr' ? 'QR Code' : 'Pareamento'}
              </button>
            ))}
          </div>

          {method === 'qr' && (
            <div className="text-center space-y-4">
              {qrQuery.isError ? (
                <Card variant="glass" className="border-danger/30 text-left">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                    <ErrorText>{getErrMsg(qrQuery.error)}</ErrorText>
                  </div>
                </Card>
              ) : qrQuery.data?.qr_code ? (
                <div className="bg-white p-3 rounded-xl inline-block shadow-[var(--shadow-glow-accent)]">
                  <img
                    src={
                      qrQuery.data.qr_code.startsWith('data:')
                        ? qrQuery.data.qr_code
                        : `data:image/png;base64,${qrQuery.data.qr_code}`
                    }
                    alt="QR Code WhatsApp"
                    className="w-56 h-56"
                  />
                </div>
              ) : (
                <div className="rounded-xl w-56 h-56 bg-surface-elevated flex flex-col items-center justify-center mx-auto gap-2">
                  {qrQuery.isFetching
                    ? <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    : <QrCode className="w-12 h-12 text-text-secondary/40" />}
                  <p className="text-text-secondary text-sm">
                    {qrQuery.isFetching ? 'Gerando...' : 'Clique para gerar'}
                  </p>
                </div>
              )}

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => qrQuery.refetch()}
                  disabled={qrQuery.isFetching}
                >
                  <RefreshCw size={14} className={qrQuery.isFetching ? 'animate-spin' : ''} />
                  {qrQuery.data?.qr_code ? 'Atualizar QR Code' : 'Gerar QR Code'}
                </Button>
              </div>

              <div className="text-xs text-text-secondary space-y-0.5">
                <p>1. Abra o WhatsApp no seu celular</p>
                <p>2. Vá em <strong>Dispositivos conectados</strong> → <strong>Conectar dispositivo</strong></p>
                <p>3. Aponte a câmera para o QR Code acima</p>
              </div>
            </div>
          )}

          {method === 'pairing' && (
            <div className="space-y-4">
              <PhoneInput
                label="Número de WhatsApp"
                value={pairingPhone}
                onChange={setPairingPhone}
                disabled={pairingQuery.isFetching}
              />

              {pairingQuery.isError && (
                <ErrorText>{getErrMsg(pairingQuery.error)}</ErrorText>
              )}

              <div className="text-center">
                {pairingQuery.data?.code ? (
                  <div
                    className="bg-surface-elevated rounded-xl p-6 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors group mb-4"
                    onClick={() => {
                      navigator.clipboard.writeText(pairingQuery.data!.code)
                      toast('Código copiado!')
                    }}
                    title="Clique para copiar"
                  >
                    <p className="text-xs text-text-secondary mb-1">Digite este código no WhatsApp</p>
                    <p className="text-3xl font-mono font-bold tracking-widest">{pairingQuery.data.code}</p>
                    <p className="text-xs text-text-muted mt-2 flex items-center justify-center gap-1 group-hover:text-text-secondary transition-colors">
                      <Copy size={12} /> Clique para copiar
                    </p>
                  </div>
                ) : (
                  <div className="bg-surface-elevated rounded-xl p-8 flex flex-col items-center gap-2 mb-4">
                    {pairingQuery.isFetching
                      ? <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      : <Phone className="w-10 h-10 text-text-secondary/30" />}
                    <p className="text-text-muted text-sm">
                      {pairingQuery.isFetching ? 'Gerando código...' : 'Informe o número e clique em gerar'}
                    </p>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => pairingQuery.refetch()}
                    disabled={pairingQuery.isFetching || !pairingPhone.trim()}
                  >
                    <RefreshCw size={14} className={pairingQuery.isFetching ? 'animate-spin' : ''} />
                    {pairingQuery.data?.code ? 'Gerar novo código' : 'Gerar código'}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-text-secondary space-y-0.5">
                <p>1. Abra o WhatsApp no celular</p>
                <p>2. Vá em <strong>Configurações</strong> → <strong>Dispositivos conectados</strong></p>
                <p>3. Toque em <strong>Vincular com número de telefone</strong></p>
                <p>4. Digite o código acima</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Conectado */}
      {!noInstance && connected && (
        <Card variant="glass" className="border-success/30 text-center py-6 space-y-3">
          <div className="flex justify-center">
            {deviceInfo.data?.photo_url ? (
              <div className="relative">
                <img
                  src={deviceInfo.data.photo_url}
                  alt="Foto de perfil WhatsApp"
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-success/40"
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-success rounded-full ring-2 ring-[var(--color-surface)]" />
              </div>
            ) : (
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                  <Smartphone className="w-7 h-7 text-success" />
                </div>
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-success rounded-full ring-2 ring-[var(--color-surface)]" />
              </div>
            )}
          </div>
          <div>
            <p className="font-semibold text-success">WhatsApp conectado</p>
            {(deviceInfo.data?.phone || status.data?.phone) && (
              <p className="text-sm text-text-secondary mt-0.5">
                {formatPhone(deviceInfo.data?.phone || status.data?.phone || '')}
              </p>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Seus alunos já podem enviar mensagens para este número — você será notificado de cada mensagem.
          </p>
        </Card>
      )}
    </div>
  )
}

const THEME_OPTIONS: { id: ThemeChoice; label: string; desc: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'Automático', desc: 'Segue o sistema operacional', icon: Monitor },
  { id: 'light', label: 'Claro', desc: 'Interface clara', icon: Sun },
  { id: 'dark', label: 'Escuro', desc: 'Interface escura', icon: Moon },
]

function AparenciaTab() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">Escolha o tema visual do aplicativo.</p>
      <div className="grid grid-cols-3 gap-3">
        {THEME_OPTIONS.map(({ id, label, desc, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTheme(id)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              theme === id
                ? 'border-accent bg-accent/10 text-accent-hover'
                : 'border-border bg-surface-elevated text-text-secondary hover:border-border-strong hover:text-text'
            }`}
          >
            <Icon size={22} />
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-text-muted text-center leading-tight">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Fusos oferecidos na lista. O detectado no aparelho entra na frente quando não estiver aqui,
 * então quem mora fora desta lista continua conseguindo se configurar. */
const FUSOS = [
  { id: 'America/Sao_Paulo', label: 'Brasília, São Paulo (BRT)' },
  { id: 'America/Manaus', label: 'Manaus, Cuiabá (AMT)' },
  { id: 'America/Rio_Branco', label: 'Rio Branco (ACT)' },
  { id: 'America/Noronha', label: 'Fernando de Noronha' },
  { id: 'America/New_York', label: 'Nova York, Miami (ET)' },
  { id: 'America/Chicago', label: 'Chicago (CT)' },
  { id: 'America/Denver', label: 'Denver (MT)' },
  { id: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { id: 'Europe/Lisbon', label: 'Lisboa' },
  { id: 'Europe/London', label: 'Londres' },
  { id: 'Europe/Madrid', label: 'Madri, Paris, Roma' },
  { id: 'America/Buenos_Aires', label: 'Buenos Aires' },
  { id: 'America/Mexico_City', label: 'Cidade do México' },
  { id: 'Asia/Tokyo', label: 'Tóquio' },
  { id: 'Australia/Sydney', label: 'Sydney' },
]

function RegiaoTab() {
  const qc = useQueryClient()
  const { show: toast } = useToast()
  const perfil = useQuery({ queryKey: ['personal-me'], queryFn: personalApi.getProfile })
  const detectado = fusoDoAparelho()
  const atual = perfil.data?.timezone || detectado

  const salvar = useMutation({
    mutationFn: (tz: string) => personalApi.updateProfile({ timezone: tz }),
    onSuccess: () => {
      // As duas chaves: o resto do portal lê o fuso por ['personal-profile'].
      qc.invalidateQueries({ queryKey: ['personal-me'] })
      qc.invalidateQueries({ queryKey: ['personal-profile'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast('Fuso horário atualizado.', 'success')
    },
    onError: () => toast('Não foi possível salvar o fuso horário.', 'error'),
  })

  const opcoes = FUSOS.some((f) => f.id === atual)
    ? FUSOS
    : [{ id: atual, label: atual.replace(/_/g, ' ') }, ...FUSOS]
  const divergente = !perfil.data?.timezone && detectado !== 'America/Sao_Paulo'
  const agora = new Date().toLocaleTimeString('pt-BR', {
    timeZone: atual, hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Define o dia de cada compromisso, treino e cobrança. Um treino às 21h precisa contar no
        dia em que aconteceu, não no seguinte.
      </p>

      <Card variant="elevated" className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="tz">Fuso horário</label>
        <select
          id="tz"
          value={atual}
          disabled={perfil.isLoading || salvar.isPending}
          onChange={(e) => salvar.mutate(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm"
        >
          {opcoes.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <Info size={13} /> Agora são <span className="font-medium text-text-secondary">{agora}</span> nesse fuso.
        </p>
        {divergente && (
          <p className="text-xs text-warning">
            Seu aparelho está em <span className="font-medium">{detectado.replace(/_/g, ' ')}</span>.
            Se for onde você atende, selecione para salvar.
          </p>
        )}
      </Card>

      <p className="text-xs text-text-muted">
        Cada aluno pode ter o próprio fuso — quem não tiver, usa o seu. O app do aluno detecta
        sozinho no primeiro acesso.
      </p>
    </div>
  )
}

function NotificacoesTab() {
  const qc = useQueryClient()
  const { show: toast } = useToast()
  const { isSubscribed, permission, subs, refreshStatus, requestAndSubscribe, unsubscribe } = usePushPersonal()
  const [busy, setBusy] = useState(false)

  useEffect(() => { refreshStatus() }, [refreshStatus])

  const perfil = useQuery({ queryKey: ['personal-me'], queryFn: personalApi.getProfile })
  const salvarPref = useMutation({
    mutationFn: (v: boolean) => personalApi.updateProfile({ notif_treino_concluido: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-me'] }),
    onError: () => toast('Não foi possível salvar a preferência.', 'error'),
  })
  const avisaTreino = perfil.data?.notif_treino_concluido !== false

  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const semSuporte = !('Notification' in window) || !('PushManager' in window)

  async function acao(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn(); await refreshStatus() } finally { setBusy(false) }
  }

  async function enviarTeste() {
    setBusy(true)
    try {
      const r = await pushPersonalApi.test()
      if (r.enviados > 0) toast(`Teste enviado para ${r.enviados} dispositivo(s).`, 'success')
      else toast('Nenhum dispositivo registrado para receber o teste.', 'error')
      await refreshStatus()
    } catch {
      toast('Falha ao enviar o teste.', 'error')
    } finally { setBusy(false) }
  }

  const statusLabel =
    semSuporte ? 'Este navegador não suporta notificações'
      : permission === 'denied' ? 'Bloqueadas no navegador'
      : subs === 0 ? 'Nenhum dispositivo registrado'
      : subs === null ? 'Verificando…'
      : `${subs} dispositivo${subs > 1 ? 's' : ''} registrado${subs > 1 ? 's' : ''}`

  return (
    <div className="space-y-4">
      <Card variant="elevated" className="space-y-4">
        <div>
          <h3 className="font-medium text-text">Notificações neste dispositivo</h3>
          <p className="text-sm text-text-secondary mt-1">
            Avisos de dor, dúvida, mensagem, cobrança e treino concluído chegam no celular mesmo com
            o portal fechado.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {subs && subs > 0
            ? <CheckCircle size={16} className="text-success shrink-0" />
            : <AlertCircle size={16} className="text-warning shrink-0" />}
          <span className="text-text-secondary">{statusLabel}</span>
        </div>

        {permission === 'denied' && (
          <p className="text-xs text-text-muted leading-relaxed">
            Você bloqueou as notificações para este site. Reative pelo cadeado ao lado do endereço
            (ou em Ajustes → Notificações, no celular) e recarregue a página.
          </p>
        )}
        {isIos && !isStandalone && (
          <p className="text-xs text-text-muted leading-relaxed">
            No iPhone/iPad, o Safari só entrega notificações quando o CoachPilot está instalado na
            tela de início. Use Compartilhar → Adicionar à Tela de Início e abra o app por lá.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!isSubscribed && permission !== 'denied' && !semSuporte && (
            <Button size="sm" disabled={busy} onClick={() => acao(requestAndSubscribe)}>
              Ativar notificações
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={busy || !subs} onClick={enviarTeste}>
            Enviar teste
          </Button>
          {isSubscribed && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => acao(unsubscribe)}>
              Desativar neste dispositivo
            </Button>
          )}
        </div>
      </Card>

      <Card variant="elevated">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 accent-accent w-4 h-4"
            checked={avisaTreino}
            disabled={perfil.isLoading || salvarPref.isPending}
            onChange={(e) => salvarPref.mutate(e.target.checked)}
          />
          <span>
            <span className="text-sm font-medium text-text">Avisar quando um aluno concluir um treino</span>
            <span className="block text-xs text-text-muted mt-0.5">
              Uma notificação por sessão finalizada pelo aluno no app, com o treino, os exercícios
              feitos e a duração. Sessões que você mesmo conduz pelo portal não geram aviso.
            </span>
          </span>
        </label>
      </Card>
    </div>
  )
}

function AnamneseTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Configure o questionário de saúde e gere um link para o aluno se cadastrar sozinho.
      </p>
      <AnamneseEditor />
    </div>
  )
}

/** Traduções do `?mp=` com que o callback do OAuth devolve o personal ao portal. */
const RETORNO_MP: Record<string, { texto: string; tipo: 'success' | 'error' }> = {
  ok:       { texto: 'Mercado Pago conectado!', tipo: 'success' },
  recusado: { texto: 'Conexão recusada no Mercado Pago.', tipo: 'error' },
  expirado: { texto: 'A sessão de conexão expirou. Tente de novo.', tipo: 'error' },
  erro:     { texto: 'Não foi possível conectar. Tente de novo.', tipo: 'error' },
}

function PagamentosTab() {
  const qc = useQueryClient()
  const { show: toast } = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()

  const status = useQuery({
    queryKey: ['mp-config'],
    queryFn: financeiroApi.getMpConfig,
  })

  const conectado = status.data?.configurado === true
  const precisaReconectar = status.data?.status === 'REQUER_RECONEXAO'
  const disponivel = status.data?.oauth_disponivel !== false

  // A volta do Mercado Pago chega como ?mp=ok|recusado|expirado|erro. Lida uma vez e a
  // URL é limpa em seguida — senão um F5 repetiria o toast.
  useEffect(() => {
    const r = params.get('mp')
    if (!r) return
    const { texto, tipo } = RETORNO_MP[r] ?? RETORNO_MP.erro
    toast(texto, tipo)
    qc.invalidateQueries({ queryKey: ['mp-config'] })
    const resto = new URLSearchParams(params)
    resto.delete('mp')
    setParams(resto, { replace: true })
  }, [params, setParams, toast, qc])

  const oauth = useMutation({
    mutationFn: financeiroApi.mpOauthIniciar,
    // Navegação de DOCUMENTO, não fetch: o personal sai para o Mercado Pago e volta
    // pelo callback. Um XHR aqui só receberia o HTML da tela de login do MP.
    onSuccess: (d) => window.location.assign(d.url),
    onError: () => toast('Não foi possível abrir o Mercado Pago.', 'error'),
  })

  async function handleDesconectar() {
    const ok = await confirm({
      title: 'Desconectar Mercado Pago',
      message: 'Seus alunos deixam de conseguir pagar por Pix até você conectar de novo. '
        + 'Cobranças já pagas não são afetadas.',
      confirmLabel: 'Desconectar',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await financeiroApi.deleteMpConfig()
      qc.invalidateQueries({ queryKey: ['mp-config'] })
      toast('Mercado Pago desconectado.', 'success')
    } catch {
      toast('Erro ao desconectar.', 'error')
    }
  }

  const botaoConectar = (
    <Button variant="primary" size="sm" disabled={oauth.isPending || !disponivel}
      onClick={() => oauth.mutate()}>
      {oauth.isPending ? 'Abrindo…' : precisaReconectar ? 'Reconectar' : 'Conectar com Mercado Pago'}
    </Button>
  )

  return (
    <div className="space-y-4">
      <Card variant="elevated">
        <div className="flex items-center gap-3 mb-3">
          <Banknote size={20} className="text-accent-hover" />
          <div>
            <p className="font-semibold text-text">Mercado Pago — Pix</p>
            <p className="text-xs text-text-secondary">Opcional · permite que alunos paguem via Pix</p>
          </div>
          {conectado && (
            <span className="ml-auto text-xs font-medium text-success flex items-center gap-1">
              <CheckCircle size={13} /> Conectado
            </span>
          )}
          {precisaReconectar && (
            <span className="ml-auto text-xs font-medium text-danger flex items-center gap-1">
              <AlertCircle size={13} /> Reconecte
            </span>
          )}
        </div>

        {!disponivel ? (
          <p className="text-sm text-text-secondary">
            A conexão com o Mercado Pago está temporariamente indisponível. Tente mais tarde.
          </p>
        ) : conectado ? (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              {status.data?.apelido && (
                <>Conta <strong className="text-text">{status.data.apelido}</strong>
                  {status.data?.conectado_em && <> · conectada desde {new Date(status.data.conectado_em).toLocaleDateString('pt-BR')}</>}
                  .{' '}
                </>
              )}
              Você pode revogar o acesso aqui ou no painel do Mercado Pago a qualquer momento.
            </p>
            <Button type="button" variant="ghost" size="sm" className="text-danger gap-1"
              onClick={handleDesconectar}>
              <Trash2 size={14} /> Desconectar
            </Button>
          </div>
        ) : precisaReconectar ? (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              A conexão com o Mercado Pago expirou ou foi revogada, então seus alunos não
              conseguem pagar por Pix agora. Reconectar leva um clique — as cobranças em
              aberto continuam valendo.
            </p>
            {botaoConectar}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Conecte sua conta do Mercado Pago para que seus alunos paguem por Pix direto pelo
              app. Você autoriza na tela do próprio Mercado Pago. O dinheiro cai 100% na sua
              conta.
            </p>
            {botaoConectar}
          </div>
        )}
      </Card>

      <Card variant="elevated" className="text-xs text-text-muted leading-relaxed">
        <p className="font-medium text-text-secondary mb-1">Sobre as taxas do Mercado Pago</p>
        <p>
          Pagamentos via Pix pelo Mercado Pago podem ter taxa de processamento cobrada pelo próprio Mercado Pago.
          A taxa divulgada atualmente para Pix com QR Code é de aproximadamente 0,99% por transação, mas esse
          valor pode variar conforme sua conta, condições comerciais ou regras vigentes do Mercado Pago.
          Consulte sua conta Mercado Pago para confirmar as taxas aplicáveis.
        </p>
      </Card>
    </div>
  )
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') as TabId | null
  const activeTab: TabId = TABS.some(t => t.id === rawTab) ? rawTab! : 'whatsapp'

  function selectTab(id: TabId) {
    setSearchParams({ tab: id }, { replace: true })
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="font-display text-xl font-semibold mb-4">Configurações</h1>

      <Tabs
        tabs={TABS.map(t => ({ key: t.id, label: t.label }))}
        active={activeTab}
        onChange={(k) => selectTab(k as TabId)}
        className="mb-6"
      />

      {activeTab === 'whatsapp' && <WhatsAppTab />}
      {activeTab === 'anamnese' && <AnamneseTab />}
      {activeTab === 'pagamentos' && <PagamentosTab />}
      {activeTab === 'notificacoes' && <NotificacoesTab />}
      {activeTab === 'conexoes' && <ConexoesTab />}
      {activeTab === 'regiao' && <RegiaoTab />}
      {activeTab === 'aparencia' && <AparenciaTab />}
    </div>
  )
}
