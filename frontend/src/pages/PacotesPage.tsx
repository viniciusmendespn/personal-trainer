import { useRef, useState } from 'react'
import { Package, Upload, ChevronDown, ChevronRight, Trash2, ToggleLeft, ToggleRight, Bot, Download } from 'lucide-react'
import { usePacotes, useImportarPacote, useImportarRascunho, useTogglePacote, useToggleItem, useRemoverPacote } from '../hooks/usePacotes'
import { useTemplates } from '../hooks/useTemplates'
import { useRotinas } from '../hooks/useRotinas'
import { Button, Card, Spinner, EmptyState, Modal, Badge, Tabs, useToast, useConfirm } from '../components/ui'
import type { ImportarPacoteResponse, PacoteInstalado } from '../types'

// ── Tela de importação ────────────────────────────────────────────────────────

function ImportarIASection() {
  const [json, setJson] = useState('')
  const [result, setResult] = useState<ImportarPacoteResponse | null>(null)
  const importarRascunho = useImportarRascunho()
  const { show: toast } = useToast()

  async function handleImportarIA() {
    if (!json.trim()) return
    try {
      const res = await importarRascunho.mutateAsync(json.trim())
      setResult(res)
      setJson('')
    } catch (err: any) {
      const code = err?.response?.data?.code
      const msgs: Record<string, string> = {
        ESTRUTURA_INVALIDA: 'O JSON gerado pela IA tem um erro de estrutura. Verifique se seguiu o prompt corretamente.',
        ARQUIVO_INVALIDO: 'JSON inválido. Certifique-se de copiar apenas o bloco de código gerado pela IA.',
        PACOTE_JA_IMPORTADO: 'Este pacote já foi importado na sua conta.',
        PACOTE_SECRET_NAO_CONFIGURADO: 'Configuração do servidor incompleta. Contate o suporte.',
      }
      const detail = err?.response?.data?.detail
      const suffix = detail ? ` (${detail})` : ''
      toast((msgs[code] ?? 'Erro ao importar. Tente novamente.') + suffix, 'error')
    }
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-accent shrink-0" />
            <div>
              <p className="font-medium text-sm">Gerar pacote com IA</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Baixe o prompt, cole em qualquer IA, responda 4 perguntas e cole o JSON abaixo.
              </p>
            </div>
          </div>
          <a
            href="/prompt-cpkg.md"
            download="prompt-cpkg.md"
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline shrink-0"
          >
            <Download size={14} />
            Baixar prompt
          </a>
        </div>

        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder='Cole aqui o JSON gerado pela IA (bloco { "version": "1", ... })'
          className="w-full h-36 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-secondary/60"
        />

        <div className="mt-3 flex justify-end">
          <Button
            onClick={handleImportarIA}
            disabled={!json.trim() || importarRascunho.isPending}
          >
            {importarRascunho.isPending ? (
              <span className="flex items-center gap-2"><Spinner className="w-4 h-4" /> Importando...</span>
            ) : (
              <span className="flex items-center gap-2"><Bot size={16} /> Importar JSON da IA</span>
            )}
          </Button>
        </div>
      </Card>

      {result && (
        <SuccessModal result={result} onClose={() => setResult(null)} />
      )}
    </>
  )
}

function ImportarTab() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<ImportarPacoteResponse | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const importar = useImportarPacote()
  const { show: toast } = useToast()

  function handleFileChange(f: File | null) {
    if (!f) return
    if (!f.name.endsWith('.cpkg')) {
      toast('Selecione um arquivo .cpkg válido.', 'error')
      return
    }
    setFile(f)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFileChange(e.target.files?.[0] ?? null)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    handleFileChange(e.dataTransfer.files[0] ?? null)
  }

  async function handleImport() {
    if (!file) return
    const text = await file.text()
    try {
      const res = await importar.mutateAsync(text)
      setResult(res)
      setFile(null)
    } catch (err: any) {
      const code = err?.response?.data?.code
      const msgs: Record<string, string> = {
        ASSINATURA_INVALIDA: 'Arquivo inválido ou corrompido (assinatura incorreta).',
        TOKEN_INVALIDO: 'Token de ativação inválido.',
        TOKEN_ESGOTADO: 'Este token já foi utilizado por outro personal.',
        TOKEN_JA_USADO: 'Você já importou este pacote.',
        PACOTE_SECRET_NAO_CONFIGURADO: 'Configuração do servidor incompleta. Contate o suporte.',
      }
      toast(msgs[code] ?? 'Erro ao importar o pacote. Tente novamente.', 'error')
    }
  }

  return (
    <>
      <Card className="p-6">
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/60'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={32} className="mx-auto mb-3 text-text-secondary" />
          {file ? (
            <p className="text-sm font-medium">{file.name}</p>
          ) : (
            <>
              <p className="text-sm font-medium mb-1">Arraste o arquivo .cpkg aqui</p>
              <p className="text-xs text-text-secondary">ou clique para selecionar</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".cpkg"
            className="hidden"
            onChange={onInputChange}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleImport}
            disabled={!file || importar.isPending}
          >
            {importar.isPending ? (
              <span className="flex items-center gap-2"><Spinner className="w-4 h-4" /> Importando...</span>
            ) : (
              <span className="flex items-center gap-2"><Package size={16} /> Importar Pacote</span>
            )}
          </Button>
        </div>
      </Card>

      {result && (
        <SuccessModal
          result={result}
          onClose={() => setResult(null)}
        />
      )}

      <ImportarIASection />
    </>
  )
}

function SuccessModal({ result, onClose }: { result: ImportarPacoteResponse; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Pacote importado com sucesso!">
      <div className="space-y-3">
        <p className="font-medium">{result.nome}</p>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          <span>{result.exercicios_importados} exercício(s) adicionado(s) à biblioteca</span>
          <span>{result.templates_importados} template(s) criado(s)</span>
          <span>{result.rotinas_importadas} rotina(s) criada(s)</span>
        </div>
        {result.licenciado && (
          <Badge tone="accent" className="mt-1">Pacote licenciado — token consumido</Badge>
        )}
        <div className="pt-2 flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Card de pacote instalado ──────────────────────────────────────────────────

function PacoteCard({ pacote }: { pacote: PacoteInstalado }) {
  const [expanded, setExpanded] = useState(false)
  const togglePacote = useTogglePacote()
  const toggleItem = useToggleItem()
  const remover = useRemoverPacote()
  const confirm = useConfirm()

  const { data: templates } = useTemplates()
  const { data: rotinas } = useRotinas()

  const templatesDoP = (templates ?? []).filter((t) => t.pacote_id === pacote.pacote_id)
  const rotinasDoP = (rotinas ?? []).filter((r) => r.pacote_id === pacote.pacote_id)

  async function handleTogglePacote() {
    await togglePacote.mutateAsync({ pacoteId: pacote.pacote_id, ativo: !pacote.ativo })
  }

  async function handleToggleItem(itemId: string, ativo: boolean) {
    await toggleItem.mutateAsync({ pacoteId: pacote.pacote_id, itemId, ativo })
  }

  async function handleRemover() {
    const ok = await confirm({
      message: `Remover "${pacote.nome}" e todos os seus itens (exercícios, templates e rotinas)?`,
      confirmLabel: 'Remover',
      tone: 'danger',
    })
    if (!ok) return
    await remover.mutateAsync(pacote.pacote_id)
  }

  const ChevronIcon = expanded ? ChevronDown : ChevronRight
  const ToggleIcon = pacote.ativo ? ToggleRight : ToggleLeft

  return (
    <Card className={`p-4 transition-opacity ${!pacote.ativo ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 text-text-secondary hover:text-text shrink-0"
            aria-label={expanded ? 'Recolher' : 'Expandir'}
          >
            <ChevronIcon size={16} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{pacote.nome}</span>
              {pacote.licenciado ? (
                <Badge tone="accent">Licenciado</Badge>
              ) : (
                <Badge tone="neutral">Livre</Badge>
              )}
              {pacote.versao && <Badge tone="neutral">v{pacote.versao}</Badge>}
            </div>
            {pacote.autor && <p className="text-xs text-text-secondary mt-0.5">{pacote.autor}</p>}
            <p className="text-xs text-text-secondary mt-0.5">
              {pacote.exlib_ids.length} ex · {pacote.template_ids.length} templates · {pacote.rotina_ids.length} rotinas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTogglePacote}
            disabled={togglePacote.isPending}
            className={`transition-colors ${pacote.ativo ? 'text-accent' : 'text-text-secondary'} hover:opacity-80`}
            aria-label={pacote.ativo ? 'Desativar pacote' : 'Ativar pacote'}
            title={pacote.ativo ? 'Desativar pacote' : 'Ativar pacote'}
          >
            <ToggleIcon size={24} />
          </button>
          <button
            type="button"
            onClick={handleRemover}
            disabled={remover.isPending}
            className="text-text-secondary hover:text-danger transition-colors"
            aria-label="Remover pacote"
            title="Remover pacote"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {templatesDoP.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Templates</p>
              <div className="space-y-1">
                {templatesDoP.map((t) => {
                  const ativo = t.ativo !== false
                  return (
                    <div key={t.template_id} className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${!ativo ? 'text-text-secondary line-through' : ''}`}>{t.nome}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleItem(t.template_id, !ativo)}
                        disabled={toggleItem.isPending}
                        className={`transition-colors shrink-0 ${ativo ? 'text-accent' : 'text-text-secondary'} hover:opacity-80`}
                        aria-label={ativo ? 'Desativar' : 'Ativar'}
                      >
                        {ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {rotinasDoP.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Rotinas</p>
              <div className="space-y-1">
                {rotinasDoP.map((r) => {
                  const ativo = r.ativo !== false
                  return (
                    <div key={r.rotina_id} className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${!ativo ? 'text-text-secondary line-through' : ''}`}>{r.nome}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleItem(r.rotina_id, !ativo)}
                        disabled={toggleItem.isPending}
                        className={`transition-colors shrink-0 ${ativo ? 'text-accent' : 'text-text-secondary'} hover:opacity-80`}
                        aria-label={ativo ? 'Desativar' : 'Ativar'}
                      >
                        {ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {templatesDoP.length === 0 && rotinasDoP.length === 0 && (
            <p className="text-xs text-text-secondary">Nenhum template ou rotina neste pacote.</p>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Aba de pacotes instalados ─────────────────────────────────────────────────

function InstaladosTab() {
  const { data: pacotes, isLoading } = usePacotes()

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  if (!pacotes || pacotes.length === 0) {
    return (
      <EmptyState
        icon={<Package size={32} className="text-text-secondary" />}
        title="Nenhum pacote instalado"
        description="Importe um arquivo .cpkg para começar."
      />
    )
  }

  return (
    <div className="space-y-3">
      {pacotes.map((p) => <PacoteCard key={p.pacote_id} pacote={p} />)}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function PacotesPage() {
  const [tab, setTab] = useState<'importar' | 'instalados'>('importar')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Package size={20} className="text-accent" />
        <h2 className="font-display text-xl font-semibold">Pacotes de treino</h2>
      </div>
      <p className="text-sm text-text-secondary mb-4">
        Importe pacotes .cpkg com exercícios, templates e rotinas prontos para usar.
      </p>

      <Tabs
        tabs={[
          { key: 'importar', label: 'Importar' },
          { key: 'instalados', label: 'Instalados' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
        className="mb-4"
      />

      {tab === 'importar' && <ImportarTab />}
      {tab === 'instalados' && <InstaladosTab />}
    </div>
  )
}
