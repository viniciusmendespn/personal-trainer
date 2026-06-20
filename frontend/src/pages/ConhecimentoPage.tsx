import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Brain, Download, FileText, Trash2, Upload } from 'lucide-react'
import { useConhecimentoArquivos, useDeleteConhecimentoArquivo } from '../hooks/useDominio'
import { conhecimentoApi, uploadConhecimentoArquivo } from '../api/conhecimento'
import { Button, Card, Spinner, EmptyState, useConfirm, useToast } from '../components/ui'
import type { ArquivoConhecimento } from '../types'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ConhecimentoPage() {
  const { data: arquivos, isLoading } = useConhecimentoArquivos()
  const del = useDeleteConhecimentoArquivo()
  const confirm = useConfirm()
  const toast = useToast()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleFiles(files: FileList) {
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        await uploadConhecimentoArquivo(file)
      }
      toast.show('Arquivo(s) enviado(s) com sucesso.')
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Falha ao enviar arquivo.', 'error')
    } finally {
      setUploading(false)
      qc.invalidateQueries({ queryKey: ['conhecimento'] })
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    e.target.value = ''
    if (files?.length) handleFiles(files)
  }

  async function remove(arquivo: ArquivoConhecimento) {
    const ok = await confirm({
      title: 'Remover arquivo',
      message: `Remover "${arquivo.filename}" da base de conhecimento? Os alunos deixarão de receber esse arquivo no próximo download.`,
      confirmLabel: 'Remover', tone: 'danger',
    })
    if (ok) del.mutate(arquivo.arquivo_id)
  }

  async function baixarZip() {
    setDownloading(true)
    try {
      const { download_url } = await conhecimentoApi.getDownloadUrl()
      window.open(download_url, '_blank')
    } catch {
      toast.show('Não foi possível gerar o .zip — confira se há arquivos cadastrados.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-display text-xl font-semibold">Base de conhecimento para IA</h2>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={baixarZip} disabled={downloading || !arquivos?.length}>
            <span className="flex items-center gap-1"><Download size={16} /> {downloading ? 'Gerando…' : 'Baixar .zip'}</span>
          </Button>
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            <span className="flex items-center gap-1"><Upload size={16} /> {uploading ? 'Enviando…' : 'Anexar'}</span>
          </Button>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={onChange} />
        </div>
      </div>
      <p className="text-sm text-text-secondary mb-4">
        Anexe PDFs, docs ou outros materiais sobre exercícios e treino. O aluno baixa tudo num único
        .zip — junto vai um arquivo de instruções pra usar com qualquer IA (ChatGPT etc.), que responde
        só com base nesses documentos.
      </p>

      {isLoading ? (
        <Spinner />
      ) : !arquivos?.length ? (
        <EmptyState icon={<Brain />} title="Nenhum arquivo ainda" description='Use o botão "Anexar" para enviar o primeiro material.' />
      ) : (
        <div className="space-y-2">
          {arquivos.map((a) => (
            <Card key={a.arquivo_id} variant="elevated" className="flex items-center justify-between">
              <div className="min-w-0 flex items-center gap-2">
                <FileText size={18} className="text-text-muted shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.filename}</p>
                  <p className="text-xs text-text-muted">{formatSize(a.size_bytes)}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" iconOnly aria-label="Remover" onClick={() => remove(a)} className="hover:text-danger">
                <Trash2 size={15} />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
