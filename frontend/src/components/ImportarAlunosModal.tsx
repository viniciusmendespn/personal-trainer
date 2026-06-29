import { useState } from 'react'
import { Copy, Check, ExternalLink, FileUp, AlertCircle } from 'lucide-react'
import { Modal, Button, Textarea } from './ui'
import { parseCsvAlunos } from '../utils/parseCsv'
import { useImportarAlunos } from '../hooks/useAlunos'
import type { ImportarAlunosResult } from '../api/alunos'

const CHATGPT_PROMPT = `Analise o arquivo anexado e extraia todos os alunos que encontrar (podem estar em uma planilha, lista, ficha de cadastro ou qualquer outro formato).

Para cada aluno encontrado, gere uma linha no formato CSV com exatamente estas 7 colunas:
nome,telefone,email,data_nascimento,objetivos,endereco,observacoes

Descrição dos campos:
- nome: nome completo do aluno (obrigatório)
- telefone: somente dígitos com DDI e DDD do Brasil, ex: 5531999998888 (obrigatório)
- email: e-mail do aluno, se houver
- data_nascimento: data no formato AAAA-MM-DD, se houver
- objetivos: objetivos separados por ponto e vírgula, ex: Emagrecimento;Hipertrofia, se houver
- endereco: endereço, se houver
- observacoes: observações gerais, restrições ou notas, se houver

Regras de formatação:
- Inclua a linha de cabeçalho exatamente como acima
- Uma linha por aluno
- Telefone: remova parênteses, espaços e traços; acrescente 55 no início se faltar o código do país
- Campos ausentes devem ficar vazios (não omita as vírgulas)
- Campos que contenham vírgula devem ser envolvidos em aspas duplas
- Não invente informações — deixe o campo vazio se não souber
- Responda APENAS com o CSV, sem explicações nem comentários`

interface Props {
  open: boolean
  onClose: () => void
}

export function ImportarAlunosModal({ open, onClose }: Props) {
  const [csv, setCsv] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<ImportarAlunosResult | null>(null)
  const importar = useImportarAlunos()

  const { valid, errors } = parseCsvAlunos(csv)

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
    <Modal open={open} onClose={handleClose} title="Importar alunos" size="lg">
      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-1 p-6 text-center space-y-1">
            <p className="text-3xl font-bold text-accent">{result.importados}</p>
            <p className="text-sm text-text-secondary">aluno{result.importados !== 1 ? 's' : ''} importado{result.importados !== 1 ? 's' : ''}</p>
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
              Copie o prompt abaixo, abra o ChatGPT, envie junto com seu arquivo (planilha, PDF, ficha…) e cole o CSV gerado no campo abaixo.
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
              placeholder={'nome,telefone,email,data_nascimento,objetivos,endereco,observacoes\nJoão Silva,5531999998888,joao@email.com,1990-05-12,Emagrecimento;Hipertrofia,,\nMaria Souza,5531988887777,,,Condicionamento,,'}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
          </div>

          {valid.length > 0 && (
            <div>
              <p className="text-xs text-text-secondary mb-2">
                <span className="font-medium text-text-primary">{valid.length}</span> aluno{valid.length !== 1 ? 's' : ''} encontrado{valid.length !== 1 ? 's' : ''}
                {errors.length > 0 && <span className="text-danger ml-2">· {errors.length} linha{errors.length !== 1 ? 's' : ''} com erro</span>}
              </p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-1 text-text-muted">
                      <th className="text-left px-3 py-2 font-medium">Nome</th>
                      <th className="text-left px-3 py-2 font-medium">Telefone</th>
                      <th className="text-left px-3 py-2 font-medium">Objetivos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valid.slice(0, 8).map((al, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 max-w-[160px] truncate">{al.nome}</td>
                        <td className="px-3 py-2 text-text-muted">{al.telefone}</td>
                        <td className="px-3 py-2 text-text-muted max-w-[140px] truncate">{al.objetivos?.join(', ') || '—'}</td>
                      </tr>
                    ))}
                    {valid.length > 8 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-center text-text-muted">
                          … e mais {valid.length - 8} aluno{valid.length - 8 !== 1 ? 's' : ''}
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
                  ? `Importar ${valid.length} aluno${valid.length !== 1 ? 's' : ''}`
                  : 'Importar alunos'}
            </span>
          </Button>
        </div>
      )}
    </Modal>
  )
}
