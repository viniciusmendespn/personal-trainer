import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QrCode, Phone, CheckCircle, AlertCircle, MessageCircle, WifiOff, RefreshCw, Copy } from 'lucide-react'
import { wapiApi } from '../api/wapi'
import { Button, Card, ErrorText } from '../components/ui'
import { useToast } from '../components/ui'
import { PhoneInput } from '../components/PhoneInput'

const SUPPORT_URL = `https://wa.me/5513988088204?text=${encodeURIComponent('Olá! Gostaria de configurar o WhatsApp no meu Personal Trainer.')}`

type Method = 'qr' | 'pairing'

function getErrMsg(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string }; status?: number }; message?: string }
  if (e?.response?.data?.detail) return e.response.data.detail
  if (e?.response?.status === 502) return 'Erro ao comunicar com W-API.'
  return e?.message || 'Erro desconhecido'
}

export function SettingsPage() {
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
      toast('Desconectado com sucesso')
    },
  })

  useEffect(() => {
    if (method === 'qr' && !noInstance && !connected && !status.isLoading) {
      const t = setTimeout(() => qrQuery.refetch(), 1500)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, noInstance, connected, status.isLoading])

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="font-display text-xl font-semibold mb-1">Conexão WhatsApp</h2>
      <p className="text-sm text-text-secondary mb-4">
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
        <Card variant="elevated" className="mb-4">
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
        <Card variant="elevated" className="mb-4">
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
        <Card variant="glass" className="border-success/30 text-center py-6 space-y-2">
          <CheckCircle className="w-10 h-10 text-success mx-auto" />
          <p className="font-semibold text-success">WhatsApp conectado com sucesso!</p>
          <p className="text-sm text-text-secondary">
            Seus alunos já podem enviar mensagens para o assistente.
          </p>
        </Card>
      )}
    </div>
  )
}
