import { useState } from 'react'
import { Download, ExternalLink, Check, FileUp } from 'lucide-react'
import { Modal, Button, Textarea, Spinner, useToast, useConfirm } from './ui'
import { useExportarPrograma, useImportarPrograma } from '../hooks/useTreinos'
import { bibliotecaApi } from '../api/biblioteca'
import { downloadText, fetchPromptMd, montarArquivoIA, slimBiblioteca } from '../utils/arquivoIa'
import type { ImportarProgramaResponse } from '../api/treinos'

interface Props {
  open: boolean
  onClose: () => void
  alunoId: string
  alunoNome?: string
}

const ERROS: Record<string, string> = {
  ESTRUTURA_INVALIDA: 'O JSON gerado pela IA tem um erro de estrutura. Verifique se seguiu o prompt corretamente.',
  ARQUIVO_INVALIDO: 'JSON inválido. Certifique-se de copiar apenas o bloco de código gerado pela IA.',
}

export function AtualizarTreinoIAModal({ open, onClose, alunoId, alunoNome }: Props) {
  const [json, setJson] = useState('')
  const [result, setResult] = useState<ImportarProgramaResponse | null>(null)
  const [baixando, setBaixando] = useState(false)
  const exportar = useExportarPrograma()
  const importar = useImportarPrograma(alunoId)
  const confirm = useConfirm()
  const { show } = useToast()

  async function handleBaixarArquivo() {
    setBaixando(true)
    try {
      const [programa, prompt, lib] = await Promise.all([
        exportar.mutateAsync(alunoId),
        fetchPromptMd('/prompt-treino-aluno.md'),
        bibliotecaApi.list(),
      ])
      const data = { ...(programa as object), biblioteca: slimBiblioteca(lib) }
      const md = montarArquivoIA(prompt, [
        {
          titulo: '📦 DADOS DO ALUNO (gerado automaticamente — não edite)',
          nota:
            '> O JSON abaixo tem tudo o que você precisa: o programa atual (`treinos`), o perfil e ' +
            'histórico completos do aluno (`contexto_aluno`) e a biblioteca de exercícios do personal ' +
            '(`biblioteca`, com o nome exato e o vídeo de cada exercício já cadastrado). Use tudo isso ' +
            'seguindo as instruções acima.',
          json: data,
        },
      ])
      const nome = (alunoNome || 'aluno').replace(/[\\/:*?"<>|]/g, '').trim()
      downloadText(md, `${nome} - treino IA.md`)
    } catch {
      show('Erro ao gerar o arquivo do aluno.', 'error')
    } finally {
      setBaixando(false)
    }
  }

  async function handleImportar() {
    if (!json.trim()) return
    const ok = await confirm({
      title: 'Sobrescrever treino',
      message: `Isso substitui TODOS os treinos atuais de ${alunoNome ?? 'este aluno'} pelo conteúdo do JSON. O histórico de sessões é preservado.`,
      confirmLabel: 'Importar e sobrescrever',
      tone: 'danger',
    })
    if (!ok) return
    try {
      const res = await importar.mutateAsync(json.trim())
      setResult(res)
      setJson('')
    } catch (err: any) {
      const code = err?.response?.data?.code
      const detail = err?.response?.data?.detail
      const suffix = detail ? ` (${detail})` : ''
      show((ERROS[code] ?? 'Erro ao importar. Tente novamente.') + suffix, 'error')
    }
  }

  function handleClose() {
    setJson('')
    setResult(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Atualizar treino com IA" size="lg">
      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-1 p-6 text-center space-y-1">
            <Check size={28} className="mx-auto text-accent" />
            <p className="text-sm text-text-secondary">
              Treino atualizado: <span className="font-semibold text-text-primary">{result.treinos_importados}</span> treino
              {result.treinos_importados !== 1 ? 's' : ''} · {result.exercicios_importados} exercício
              {result.exercicios_importados !== 1 ? 's' : ''}.
            </p>
          </div>
          <Button className="w-full" onClick={handleClose}>Fechar</Button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-text-secondary">
            Baixe <span className="text-text-primary font-medium">um único arquivo</span> — instruções + treino
            atual + perfil completo do aluno (histórico de sessões, frequência, dores, dúvidas, avaliações,
            metas e anamnese) + sua biblioteca de exercícios (com os vídeos já cadastrados). Anexe esse arquivo
            numa IA (ChatGPT, Claude, Gemini) e peça o ajuste. A IA analisa o histórico, reaproveita seus
            exercícios e devolve o JSON do programa atualizado; cole abaixo para sobrescrever.
          </p>

          <div>
            <p className="text-sm font-medium mb-2">1. Baixe o arquivo do aluno</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleBaixarArquivo} disabled={baixando}>
                <span className="flex items-center gap-1.5">
                  {baixando ? <Spinner className="w-4 h-4" /> : <Download size={15} />} Baixar arquivo para a IA
                </span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.open('https://chatgpt.com', '_blank')}>
                <span className="flex items-center gap-1.5"><ExternalLink size={15} /> Abrir ChatGPT</span>
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">2. Peça o ajuste à IA</p>
            <p className="text-xs text-text-secondary">
              Anexe o arquivo baixado e descreva a mudança em linguagem natural — ou peça "atualize o
              treino com base no histórico". A IA analisa o perfil e o histórico completos do aluno,
              reaproveita os exercícios da sua biblioteca (com os vídeos certos) e devolve o programa
              COMPLETO atualizado, apenas com o bloco de treinos.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">3. Cole o JSON atualizado</p>
            <Textarea
              rows={6}
              placeholder={'Cole aqui o JSON gerado pela IA (bloco { "version": "1", "treinos": [ ... ] })'}
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            disabled={!json.trim() || importar.isPending}
            onClick={handleImportar}
          >
            <span className="flex items-center gap-1.5">
              {importar.isPending ? <Spinner className="w-4 h-4" /> : <FileUp size={16} />}
              {importar.isPending ? 'Importando…' : 'Importar e sobrescrever treino'}
            </span>
          </Button>
        </div>
      )}
    </Modal>
  )
}
