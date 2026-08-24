import { useState } from 'react'
import { Download, ExternalLink, Check, FileUp, ListChecks } from 'lucide-react'
import { Modal, Button, Textarea, Spinner, useToast, useConfirm } from './ui'
import { RelatorioImportIA } from './RelatorioImportIA'
import { useExportarPrograma, useImportarPrograma, useValidarPrograma } from '../hooks/useTreinos'
import { bibliotecaApi } from '../api/biblioteca'
import {
  downloadText,
  fetchPromptMd,
  limparJsonColado,
  montarArquivoIA,
  renderizarPromptIA,
  slimBiblioteca,
} from '../utils/arquivoIa'
import { codigoDeErro, extrairErroImport, mensagemDeErro, type ErroImport, type ProblemaImport } from '../utils/erroApi'
import type { ImportarProgramaResponse } from '../api/treinos'

interface Props {
  open: boolean
  onClose: () => void
  alunoId: string
  alunoNome?: string
}

/** Conferência bem-sucedida: nada a corrigir, ou só avisos. */
interface Conferido {
  avisos: ProblemaImport[]
  relatorioIa?: string | null
}

export function AtualizarTreinoIAModal({ open, onClose, alunoId, alunoNome }: Props) {
  const [json, setJson] = useState('')
  const [result, setResult] = useState<ImportarProgramaResponse | null>(null)
  const [erro, setErro] = useState<ErroImport | null>(null)
  const [conferido, setConferido] = useState<Conferido | null>(null)
  const [baixando, setBaixando] = useState(false)
  const exportar = useExportarPrograma()
  const importar = useImportarPrograma(alunoId)
  const validar = useValidarPrograma(alunoId)
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
      const md = montarArquivoIA(renderizarPromptIA(prompt, slimBiblioteca(lib)), [
        {
          titulo: '📦 DADOS DO ALUNO (gerado automaticamente — não edite)',
          nota:
            '> O JSON abaixo tem o programa atual (`treinos`) e o perfil e histórico completos do ' +
            'aluno (`contexto_aluno`). A biblioteca de exercícios do personal está na seção acima. ' +
            'Use tudo isso seguindo as instruções.',
          json: programa,
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

  /** Limpa cerca de markdown/prosa e valida o JSON localmente. `null` = já reportou o erro. */
  function prepararJson(): string | null {
    const limpo = limparJsonColado(json)
    if (!limpo.ok) {
      setConferido(null)
      setErro({
        code: 'ARQUIVO_INVALIDO',
        mensagem: limpo.erro,
        problemas: [],
        total: 0,
      })
      return null
    }
    return limpo.json
  }

  async function handleConferir() {
    const conteudo = prepararJson()
    if (!conteudo) return
    setErro(null)
    try {
      const res = await validar.mutateAsync(conteudo)
      setConferido({ avisos: res.avisos ?? [], relatorioIa: res.relatorio_ia })
    } catch (err) {
      setConferido(null)
      setErro(extrairErroImport(err, 'Não foi possível conferir o JSON. Tente novamente.'))
    }
  }

  async function handleImportar() {
    const conteudo = prepararJson()
    if (!conteudo) return
    const ok = await confirm({
      title: 'Sobrescrever treino',
      message: `Isso substitui TODOS os treinos atuais de ${alunoNome ?? 'este aluno'} pelo conteúdo do JSON. O histórico de sessões é preservado.`,
      confirmLabel: 'Importar e sobrescrever',
      tone: 'danger',
    })
    if (!ok) return
    setErro(null)
    setConferido(null)
    try {
      const res = await importar.mutateAsync({ conteudo })
      setResult(res)
      setJson('')
    } catch (err) {
      // Substituição total apaga o treino que o aluno pode estar executando agora. O backend
      // recusa uma vez; aqui a decisão volta para o personal, que é quem sabe o contexto.
      if (codigoDeErro(err) === 'SESSAO_EM_ANDAMENTO') {
        const mesmoAssim = await confirm({
          title: 'O aluno está treinando agora',
          message: mensagemDeErro(err),
          confirmLabel: 'Importar mesmo assim', tone: 'danger',
        })
        if (!mesmoAssim) return
        try {
          const res = await importar.mutateAsync({ conteudo, confirmar: true })
          setResult(res)
          setJson('')
        } catch (err2) {
          setErro(extrairErroImport(err2, 'Não foi possível importar. Tente novamente.'))
        }
        return
      }
      // O JSON colado FICA no textarea: o personal vai corrigi-lo com a IA e reimportar.
      setErro(extrairErroImport(err, 'Não foi possível importar. Tente novamente.'))
    }
  }

  function handleClose() {
    setJson('')
    setResult(null)
    setErro(null)
    setConferido(null)
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
          {!!result.avisos?.length && (
            <RelatorioImportIA
              avisos={result.avisos}
              relatorioIa={result.relatorio_ia ?? undefined}
            />
          )}
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
              onChange={(e) => {
                setJson(e.target.value)
                setErro(null)
                setConferido(null)
              }}
            />
          </div>

          {erro && (
            <RelatorioImportIA
              mensagem={erro.mensagem}
              problemas={erro.problemas}
              total={erro.total}
              relatorioIa={erro.relatorioIa}
            />
          )}

          {conferido && (
            <RelatorioImportIA
              limpo
              avisos={conferido.avisos}
              relatorioIa={conferido.relatorioIa ?? undefined}
              mensagem={
                conferido.avisos.length
                  ? `Pode importar, mas confira ${conferido.avisos.length} ponto${conferido.avisos.length !== 1 ? 's' : ''}.`
                  : 'Nenhum problema encontrado — o JSON está pronto para importar.'
              }
            />
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="sm:flex-1"
              disabled={!json.trim() || validar.isPending || importar.isPending}
              onClick={handleConferir}
            >
              <span className="flex items-center gap-1.5">
                {validar.isPending ? <Spinner className="w-4 h-4" /> : <ListChecks size={16} />}
                {validar.isPending ? 'Conferindo…' : 'Conferir sem importar'}
              </span>
            </Button>
            <Button
              className="sm:flex-1"
              disabled={!json.trim() || importar.isPending || validar.isPending}
              onClick={handleImportar}
            >
              <span className="flex items-center gap-1.5">
                {importar.isPending ? <Spinner className="w-4 h-4" /> : <FileUp size={16} />}
                {importar.isPending ? 'Importando…' : 'Importar e sobrescrever treino'}
              </span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
