import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QrCode, Phone, CheckCircle, AlertCircle, MessageCircle, WifiOff, RefreshCw, Copy, Smartphone, Banknote, Trash2, Info } from 'lucide-react'
import { wapiApi } from '../api/wapi'
import { financeiroApi } from '../api/financeiro'
import { Button, Card, ErrorText, Tabs, Modal } from '../components/ui'
import { useToast } from '../components/ui'
import { PhoneInput } from '../components/PhoneInput'
import { AnamneseEditor } from '../components/anamnese/AnamneseEditor'

const SUPPORT_URL = `https://wa.me/5513988088204?text=${encodeURIComponent('Olá! Gostaria de configurar o WhatsApp no meu Personal Trainer.')}`

type TabId = 'whatsapp' | 'anamnese' | 'pagamentos'

const TABS: { id: TabId; label: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'anamnese', label: 'Anamnese' },
  { id: 'pagamentos', label: 'Pagamentos' },
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

  const status = useQuery({
    queryKey: ['wapi-status'],
    queryFn: wapiApi.status,
    retry: false,
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false
      if (query.state.data?.connected) return false
      return 5000
    },
  })

  const noInstance = status.isError && (status.error as any)?.response?.status === 404
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
    if (method === 'qr' && !connected && status.isSuccess) {
      const t = setTimeout(() => qrQuery.refetch(), 1500)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, noInstance, connected, status.isLoading])

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Conecte seu número para que seus alunos conversem com o assistente.
      </p>

      {/* Sem instância configurada */}
      {noInstance && (
        <Card variant="elevated" className="text-center py-8 space-y-4">
          <AlertCircle className="w-12 h-12 text-blue-400 mx-auto" />
          <div>
            <p className="font-semibold text-lg mb-1">Instância não configurada</p>
            <p className="text-sm text-text-secondary">
              Para conectar o WhatsApp, solicite sua instância pelo suporte.
              Após a ativação, volte aqui para escanear o QR Code.
            </p>
          </div>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 mx-auto w-fit bg-[#25D366] hover:bg-[#1db954] text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Solicitar pelo WhatsApp
          </a>
          <p className="text-xs text-text-secondary">Suporte: +55 (13) 98808-8204</p>
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
            Seus alunos já podem enviar mensagens para o assistente.
          </p>
        </Card>
      )}
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

function PagamentosTab() {
  const qc = useQueryClient()
  const { show: toast } = useToast()
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const status = useQuery({
    queryKey: ['mp-config'],
    queryFn: financeiroApi.getMpConfig,
  })

  const configurado = status.data?.configurado === true

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setSaving(true)
    try {
      await financeiroApi.setMpConfig(token.trim())
      setToken('')
      qc.invalidateQueries({ queryKey: ['mp-config'] })
      toast('Access Token salvo com sucesso.', 'success')
    } catch {
      toast('Erro ao salvar o token.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemover() {
    try {
      await financeiroApi.deleteMpConfig()
      qc.invalidateQueries({ queryKey: ['mp-config'] })
      toast('Integração removida.', 'success')
    } catch {
      toast('Erro ao remover integração.', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <Card variant="elevated">
        <div className="flex items-center gap-3 mb-3">
          <Banknote size={20} className="text-accent-hover" />
          <div>
            <p className="font-semibold text-text">Mercado Pago — Pix</p>
            <p className="text-xs text-text-secondary">Opcional · permite que alunos paguem via Pix</p>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className={`p-1 text-text-muted hover:text-text transition-colors ${configurado ? '' : 'ml-auto'}`}
            aria-label="Como obter o Access Token"
          >
            <Info size={16} />
          </button>
          {configurado && (
            <span className="ml-auto text-xs font-medium text-success flex items-center gap-1">
              <CheckCircle size={13} /> Configurado
            </span>
          )}
        </div>

        {configurado ? (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Access Token configurado. Para atualizar, insira um novo token abaixo e salve.
            </p>
            <form onSubmit={handleSalvar} className="space-y-3">
              <input
                type="password"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Novo Access Token (APP_USR-…)"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
              />
              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="sm" disabled={saving || !token.trim()}>
                  {saving ? 'Salvando…' : 'Atualizar token'}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-danger gap-1"
                  onClick={handleRemover}>
                  <Trash2 size={14} /> Remover integração
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={handleSalvar} className="space-y-3">
            <p className="text-sm text-text-secondary">
              Informe seu Access Token de produção do Mercado Pago para habilitar pagamentos via Pix.
              O token é salvo com segurança e nunca é exibido.
            </p>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="APP_USR-…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              autoComplete="off"
            />
            <Button type="submit" variant="primary" size="sm" disabled={saving || !token.trim()}>
              {saving ? 'Salvando…' : 'Salvar Access Token'}
            </Button>
          </form>
        )}
      </Card>

      <Card variant="elevated" className="text-xs text-text-muted leading-relaxed">
        <p className="font-medium text-text-secondary mb-1">Sobre as taxas do Mercado Pago</p>
        <p>
          Pagamentos via Pix pelo Mercado Pago podem ter taxa de processamento cobrada pelo próprio Mercado Pago.
          A taxa divulgada atualmente para Pix com QR Code é de aproximadamente 0,49% por transação, mas esse
          valor pode variar conforme sua conta, condições comerciais ou regras vigentes do Mercado Pago.
          Consulte sua conta Mercado Pago para confirmar as taxas aplicáveis.
        </p>
      </Card>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Como obter o Access Token">
        <ol className="space-y-2 text-sm text-text-secondary list-decimal list-inside">
          <li>Pré-requisito: ter conta no Mercado Pago.</li>
          <li>
            Acesse{' '}
            <a
              href="https://www.mercadopago.com.br/developers/panel/app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              mercadopago.com.br/developers/panel/app
            </a>
            .
          </li>
          <li>Clique em <strong>Criar aplicação</strong>.</li>
          <li>Dê um nome para a aplicação, ex.: <strong>"CoachPilot - Vinicius"</strong>.</li>
          <li>Em "Como você vai usar o Mercado Pago", selecione <strong>Pagamentos online</strong>.</li>
          <li>Selecione <strong>Com um desenvolvimento próprio</strong>.</li>
          <li>Informe a URL da loja, ex.: <strong>https://coachpilot.com.br</strong>.</li>
          <li>Selecione <strong>Checkout Transparente</strong>.</li>
          <li>Selecione <strong>API de Orders</strong>.</li>
          <li>Autorize os termos e condições e confirme a criação.</li>
          <li>Após criar a integração, clique em <strong>Credenciais de produção</strong>.</li>
          <li>Selecione o Setor: <strong>Serviços de consultoria</strong>.</li>
          <li>Autorize os termos e ative as credenciais de produção.</li>
          <li>Copie o <strong>Access Token</strong> (começa com <strong>APP_USR-</strong>) e cole no campo abaixo.</li>
        </ol>
      </Modal>
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
    </div>
  )
}
