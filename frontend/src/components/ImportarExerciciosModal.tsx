import { useState } from 'react'
import { Copy, Check, ExternalLink, FileUp, AlertCircle } from 'lucide-react'
import { Modal, Button, Textarea } from './ui'
import { parseCsvBiblioteca } from '../utils/parseCsv'
import { useImportarExercicios } from '../hooks/useDominio'
import type { ImportarResult } from '../api/biblioteca'

const CHATGPT_PROMPT = `Converta o arquivo anexado em CSV com exatamente estas colunas, separadas por vírgula:
nome,grupo,video_url,descricao,recomendacoes

Regras:
- Inclua a linha de cabeçalho exatamente como acima
- Uma linha por exercício
- Se um campo não existir, deixe vazio (não omita a vírgula)
- Se um campo contiver vírgula, envolva-o em aspas duplas
- Não adicione colunas extras
- Responda APENAS com o CSV, sem explicações

Exemplos de grupos: Peito, Costas, Ombros, Bíceps, Tríceps, Pernas, Glúteos, Abdômen, Cardio, Funcional`

interface Props {
  open: boolean
  onClose: () => void
}

export function ImportarExerciciosModal({ open, onClose }: Props) {
  const [csv, setCsv] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<ImportarResult | null>(null)
  const importar = useImportarExercicios()

  const { valid, errors } = parseCsvBiblioteca(csv)

  function copyPrompt() {
    navigator.clipboard.writeText(CHATGPT_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleImport() {
    const res = await importar.mutateAsync(valid)
    setResult(res)
  }

  function handleClose() {
    setCsv('')
    setResult(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Importar exercícios" size="lg">
      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-1 p-6 text-center space-y-1">
            <p className="text-3xl font-bold text-accent">{result.importados}</p>
            <p className="text-sm text-text-secondary">exercício{result.importados !== 1 ? 's' : ''} importado{result.importados !== 1 ? 's' : ''}</p>
            {result.pulados > 0 && (
              <p className="text-xs text-text-muted mt-2">{result.pulados} já existia{result.pulados !== 1 ? 'm' : ''} e {result.pulados !== 1 ? 'foram' : 'foi'} pulado{result.pulados !== 1 ? 's' : ''}</p>
            )}
          </div>
          {result.erros.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-danger">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {result.erros.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            </div>
          )}
          <Button className="w-full" onClick={handleClose}>Fechar</Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium mb-1">1. Converta seu arquivo no ChatGPT</p>
            <p className="text-xs text-text-secondary mb-2">
              Copie o prompt abaixo, abra o ChatGPT, envie junto com seu arquivo (planilha, PDF, Word…) e cole o CSV gerado no campo abaixo.
            </p>
            <div className="relative rounded-md bg-surface-1 border border-border p-3 pr-24">
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">{CHATGPT_PROMPT}</pre>
              <div className="absolute top-2 right-2 flex gap-1">
                <Button size="sm" variant="ghost" iconOnly aria-label="Copiar prompt" onClick={copyPrompt}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  aria-label="Abrir ChatGPT"
                  onClick={() => window.open('https://chatgpt.com', '_blank')}
                >
                  <ExternalLink size={14} />
                </Button>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">2. Cole o CSV gerado</p>
            <Textarea
              rows={6}
              placeholder={'nome,grupo,video_url,descricao,recomendacoes\nSupino Reto,Peito,,Exercício de peito com barra,Manter escápulas retraídas\nAgachamento,Pernas,,,'}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
          </div>

          {valid.length > 0 && (
            <div>
              <p className="text-xs text-text-secondary mb-2">
                <span className="font-medium text-text-primary">{valid.length}</span> exercício{valid.length !== 1 ? 's' : ''} encontrado{valid.length !== 1 ? 's' : ''}
                {errors.length > 0 && <span className="text-danger ml-2">· {errors.length} linha{errors.length !== 1 ? 's' : ''} com erro</span>}
              </p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-1 text-text-muted">
                      <th className="text-left px-3 py-2 font-medium">Nome</th>
                      <th className="text-left px-3 py-2 font-medium">Grupo</th>
                      <th className="text-left px-3 py-2 font-medium">Vídeo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valid.slice(0, 8).map((ex, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 max-w-[160px] truncate">{ex.nome}</td>
                        <td className="px-3 py-2 text-text-muted">{ex.grupo ?? '—'}</td>
                        <td className="px-3 py-2 text-text-muted">{ex.video_url ? '✓' : '—'}</td>
                      </tr>
                    ))}
                    {valid.length > 8 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-center text-text-muted">
                          … e mais {valid.length - 8} exercício{valid.length - 8 !== 1 ? 's' : ''}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {errors.length > 0 && valid.length === 0 && (
            <div className="flex items-start gap-2 text-xs text-danger">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {errors.slice(0, 3).map((e, i) => <p key={i}>{e}</p>)}
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={valid.length === 0 || importar.isPending}
            onClick={handleImport}
          >
            <span className="flex items-center gap-1.5">
              <FileUp size={16} />
              {importar.isPending
                ? 'Importando…'
                : valid.length > 0
                  ? `Importar ${valid.length} exercício${valid.length !== 1 ? 's' : ''}`
                  : 'Importar exercícios'}
            </span>
          </Button>
        </div>
      )}
    </Modal>
  )
}
