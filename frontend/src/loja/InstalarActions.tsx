import { useState } from 'react'
import { Download, PackageCheck } from 'lucide-react'
import { lojaApi } from '../api/loja'
import { downloadJson } from '../api/pacotes'
import { Button, useToast } from '../components/ui'

/** Ações de entrega de um pedido ENTREGUE: instalar direto na conta ou baixar o .cpkg. */
export function InstalarActions({ pedidoId, compact = false }: { pedidoId: string; compact?: boolean }) {
  const toast = useToast()
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)

  async function handleInstalar() {
    setInstalling(true)
    try {
      const r = await lojaApi.instalar(pedidoId)
      setInstalled(true)
      toast.show(
        `Pacote "${r.nome ?? ''}" instalado: ${r.rotinas_importadas ?? 0} rotinas, ` +
        `${r.templates_importados ?? 0} treinos, ${r.exercicios_importados ?? 0} exercícios.`,
        'success',
      )
    } catch {
      toast.show('Não foi possível instalar o pacote. Tente novamente.', 'error')
    } finally {
      setInstalling(false)
    }
  }

  async function handleDownload() {
    try {
      const { filename, ...arquivo } = await lojaApi.download(pedidoId)
      downloadJson(arquivo, filename || 'pacote.cpkg')
    } catch {
      toast.show('Não foi possível baixar o arquivo.', 'error')
    }
  }

  return (
    <div className={compact ? 'flex gap-2' : 'flex flex-col sm:flex-row gap-2 w-full sm:w-auto'}>
      <Button size={compact ? 'sm' : 'md'} onClick={handleInstalar} disabled={installing}>
        <PackageCheck size={16} className="mr-1.5" />
        {installing ? 'Instalando…' : installed ? 'Instalar de novo' : 'Instalar no meu portal'}
      </Button>
      <Button size={compact ? 'sm' : 'md'} variant="outline" onClick={handleDownload}>
        <Download size={16} className="mr-1.5" />
        Baixar .cpkg
      </Button>
    </div>
  )
}
