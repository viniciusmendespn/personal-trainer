import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { wapiApi } from '../api/wapi'
import { Button, Card, Input, ErrorText, Badge } from '../components/ui'

export function SettingsPage() {
  const [instanceId, setInstanceId] = useState('')
  const [token, setToken] = useState('')
  const [qr, setQr] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const status = useQuery({ queryKey: ['wapi-status'], queryFn: wapiApi.status, retry: false })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setMsg('')
    try {
      await wapiApi.saveConfig(instanceId, token)
      setMsg('Credenciais salvas. Agora gere o QR Code para conectar.')
      status.refetch()
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Erro ao salvar')
    }
  }

  async function loadQr() {
    setError(''); setQr('')
    try {
      const r = await wapiApi.qr()
      const v = r.qr_code
      setQr(v.startsWith('data:') ? v : `data:image/png;base64,${v}`)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Erro ao gerar QR')
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="font-display text-xl font-semibold mb-1">Conexão WhatsApp (W-API)</h2>
      <p className="text-sm text-text-secondary mb-4">
        Conecte seu número para que seus alunos conversem com o assistente.
      </p>

      <Card variant="glass" className="mb-4 border-accent/30">
        <p className="text-sm font-medium text-accent-hover mb-2">Como começar</p>
        <ol className="text-sm text-text-secondary space-y-1 list-decimal list-inside">
          <li>
            Solicite sua instância enviando uma mensagem para o WhatsApp{' '}
            <a
              href="https://wa.me/5513988088204"
              target="_blank"
              rel="noreferrer"
              className="text-accent-hover font-medium hover:underline"
            >
              +55 13 98808-8204
            </a>
            .
          </li>
          <li>Cole o <b>Instance ID</b> e o <b>Token</b> recebidos abaixo e salve.</li>
          <li>Gere o <b>QR Code</b> e escaneie no WhatsApp do seu número (Aparelhos conectados).</li>
        </ol>
      </Card>

      <Card variant="elevated" className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm flex items-center gap-2">
            Status:
            <Badge tone={status.data?.connected ? 'success' : 'neutral'}>
              {status.data?.connected ? `Conectado (${status.data.phone ?? '—'})` : 'Desconectado'}
            </Badge>
          </span>
          <Button variant="ghost" size="sm" iconOnly aria-label="Atualizar status" onClick={() => status.refetch()}>
            <RefreshCw size={16} />
          </Button>
        </div>
      </Card>

      <Card variant="elevated" className="mb-4">
        <form onSubmit={save} className="space-y-3">
          <Input label="Instance ID" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} required />
          <Input label="Token" type="password" value={token} onChange={(e) => setToken(e.target.value)} required />
          <Button type="submit">Salvar credenciais</Button>
        </form>
      </Card>

      <div className="space-y-3">
        <Button variant="outline" onClick={loadQr}>Gerar QR Code</Button>
        {qr && (
          <Card variant="elevated" className="flex justify-center bg-white shadow-[var(--shadow-glow-accent)]">
            <img src={qr} alt="QR Code WhatsApp" className="w-56 h-56" />
          </Card>
        )}
        {msg && <p className="text-sm text-success">{msg}</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  )
}
