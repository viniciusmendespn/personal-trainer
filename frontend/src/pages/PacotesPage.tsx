import { useMemo, useRef, useState } from 'react'
import { Package, Upload, ChevronDown, ChevronRight, Trash2, ToggleLeft, ToggleRight, Bot, Download, Lock, Unlock, Search, ListChecks } from 'lucide-react'
import { usePacotes, useImportarPacote, useImportarRascunho, useTogglePacote, useToggleItem, useRemoverPacote, useExportarPacote, useGerarPacote, useGerarPacoteLicenciado } from '../hooks/usePacotes'
import { useTemplates } from '../hooks/useTemplates'
import { useRotinas } from '../hooks/useRotinas'
import { useBiblioteca } from '../hooks/useDominio'
import { Button, Card, Spinner, EmptyState, Modal, Badge, Tabs, useToast, useConfirm } from '../components/ui'
import { downloadJson, pacotesApi } from '../api/pacotes'
import { bibliotecaApi } from '../api/biblioteca'
import { RelatorioImportIA } from '../components/RelatorioImportIA'
import { downloadText, fetchPromptMd, limparJsonColado, renderizarPromptIA, slimBiblioteca } from '../utils/arquivoIa'
import { extrairErroImport, mensagemDeErro, type ErroImport, type ProblemaImport } from '../utils/erroApi'
import type { ExLib, ImportarPacoteResponse, PacoteInstalado } from '../types'
import { normalizeText } from '../utils/normalizeText'
import { gruposDoExercicio } from '../utils/grupos'

// ── Tela de importação ────────────────────────────────────────────────────────

function ImportarIASection() {
  const [json, setJson] = useState('')
  const [result, setResult] = useState<ImportarPacoteResponse | null>(null)
  const [erro, setErro] = useState<ErroImport | null>(null)
  const [conferido, setConferido] = useState<{ avisos: ProblemaImport[]; relatorioIa?: string | null } | null>(null)
  const [conferindo, setConferindo] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const importarRascunho = useImportarRascunho()
  const { show: toast } = useToast()

  async function handleBaixarArquivo() {
    setBaixando(true)
    try {
      const [prompt, lib] = await Promise.all([
        fetchPromptMd('/prompt-cpkg.md'),
        bibliotecaApi.list(),
      ])
      const slim = slimBiblioteca(lib)
      const md = renderizarPromptIA(prompt, slim)
      downloadText(md, 'prompt-pacote-coachpilot.md')
      if (!slim.length) {
        toast('Sua biblioteca está vazia — baixei só o prompt. Cadastre exercícios para a IA reaproveitar seus vídeos.', 'info')
      }
    } catch {
      toast('Erro ao gerar o arquivo. Tente novamente.', 'error')
    } finally {
      setBaixando(false)
    }
  }

  /** Limpa cerca de markdown/prosa e valida o JSON localmente. `null` = já reportou o erro. */
  function prepararJson(): string | null {
    const limpo = limparJsonColado(json)
    if (!limpo.ok) {
      setConferido(null)
      setErro({ code: 'ARQUIVO_INVALIDO', mensagem: limpo.erro, problemas: [], total: 0 })
      return null
    }
    return limpo.json
  }

  async function handleConferir() {
    const conteudo = prepararJson()
    if (!conteudo) return
    setErro(null)
    setConferindo(true)
    try {
      const res = await pacotesApi.validarRascunho(conteudo)
      setConferido({ avisos: res.avisos ?? [], relatorioIa: res.relatorio_ia })
    } catch (err) {
      setConferido(null)
      setErro(extrairErroImport(err, 'Não foi possível conferir o JSON. Tente novamente.'))
    } finally {
      setConferindo(false)
    }
  }

  async function handleImportarIA() {
    const conteudo = prepararJson()
    if (!conteudo) return
    setErro(null)
    setConferido(null)
    try {
      const res = await importarRascunho.mutateAsync(conteudo)
      setResult(res)
      setJson('')
    } catch (err) {
      // O JSON colado FICA no textarea: o personal corrige com a IA e reimporta.
      setErro(extrairErroImport(err, 'Não foi possível importar. Tente novamente.'))
    }
  }

  return (
    <>
      <Card variant="elevated" className="p-6 border border-accent/30 bg-gradient-to-br from-accent/10 to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-accent/15 p-2 shrink-0">
              <Bot size={24} className="text-accent-hover" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg">Ensine o ChatGPT a usar o CoachPilot por você</h3>
              <p className="text-sm text-text-secondary mt-0.5">
                Você prescreve, a IA cadastra: transforme o treino que você montou em exercícios, templates e rotinas em segundos.
              </p>
            </div>
          </div>
          <Button variant="energy" size="sm" className="shrink-0" onClick={handleBaixarArquivo} disabled={baixando}>
            <span className="flex items-center gap-1.5">
              {baixando ? <Spinner className="w-4 h-4" /> : <Download size={15} />} Baixar prompt + biblioteca
            </span>
          </Button>
        </div>

        <ol className="mt-5 mb-4 space-y-2.5">
          {[
            'Baixe o arquivo (prompt + sua biblioteca de exercícios) e anexe em qualquer IA (ChatGPT, Claude, Gemini).',
            'Descreva o treino que você quer prescrever — a IA organiza no formato do CoachPilot, reaproveitando seus exercícios e vídeos.',
            'Cole o JSON aqui embaixo: o CoachPilot cadastra tudo automaticamente.',
          ].map((txt, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent-hover text-xs font-semibold">
                {i + 1}
              </span>
              <span className="text-text-secondary pt-0.5">{txt}</span>
            </li>
          ))}
        </ol>

        <textarea
          value={json}
          onChange={(e) => {
            setJson(e.target.value)
            setErro(null)
            setConferido(null)
          }}
          placeholder='Cole aqui o JSON gerado pela IA (bloco { "version": "1", ... })'
          className="w-full h-36 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-secondary/60"
        />

        {erro && (
          <div className="mt-3">
            <RelatorioImportIA
              mensagem={erro.mensagem}
              problemas={erro.problemas}
              total={erro.total}
              relatorioIa={erro.relatorioIa}
            />
          </div>
        )}

        {conferido && (
          <div className="mt-3">
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
          </div>
        )}

        <div className="mt-3 flex flex-col sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleConferir}
            disabled={!json.trim() || conferindo || importarRascunho.isPending}
          >
            {conferindo ? (
              <span className="flex items-center gap-2"><Spinner className="w-4 h-4" /> Conferindo...</span>
            ) : (
              <span className="flex items-center gap-2"><ListChecks size={16} /> Conferir sem importar</span>
            )}
          </Button>
          <Button
            onClick={handleImportarIA}
            disabled={!json.trim() || importarRascunho.isPending || conferindo}
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

function ImportarArquivoTab() {
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
    } catch (err) {
      // O `code` vem em `detail.code` (o FastAPI aninha o dict) — ler `data.code` dava
      // undefined e o personal sempre via a mensagem genérica.
      const { code, mensagem } = extrairErroImport(err)
      const msgs: Record<string, string> = {
        ARQUIVO_INVALIDO: 'Arquivo inválido ou corrompido.',
        TOKEN_INVALIDO: 'Token de ativação inválido.',
        TOKEN_ESGOTADO: 'Este token já foi utilizado por outro personal.',
        TOKEN_JA_USADO: 'Você já importou este pacote.',
        PACOTE_INDISPONIVEL: 'Pacote indisponível ou revogado pelo autor.',
        CONTEUDO_CORROMPIDO: 'Conteúdo do pacote corrompido. Contate o autor.',
      }
      toast(msgs[code ?? ''] ?? mensagem, 'error')
    }
  }

  return (
    <>
      <Card className="p-6">
        <p className="text-sm text-text-secondary mb-4">
          Recebeu um pacote licenciado (.cpkg)? Importe o arquivo aqui. Para criar treinos do zero,
          use a aba <span className="text-text">Gerar com IA</span>.
        </p>
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
          {!!result.videos_da_biblioteca && (
            <span className="text-accent-hover">
              {result.videos_da_biblioteca} exercício(s) usaram o vídeo já cadastrado na sua biblioteca
            </span>
          )}
        </div>
        {result.licenciado && (
          <Badge tone="accent" className="mt-1">Pacote licenciado — token consumido</Badge>
        )}
        {!!result.avisos?.length && (
          <RelatorioImportIA
            avisos={result.avisos}
            relatorioIa={result.relatorio_ia ?? undefined}
          />
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
  const exportar = useExportarPacote()
  const confirm = useConfirm()
  const { show: toast } = useToast()

  const isManual = pacote.pacote_id === 'manual'

  async function handleExportar() {
    try {
      const data = await exportar.mutateAsync(pacote.pacote_id)
      downloadJson(data, `${pacote.nome}.json`)
    } catch (err) {
      const { code } = extrairErroImport(err)
      const msgs: Record<string, string> = {
        PACOTE_LICENCIADO_NAO_EXPORTAVEL: 'Pacotes licenciados não podem ser exportados.',
        PACOTE_MANUAL_NAO_EXPORTAVEL: 'O pacote manual não pode ser exportado.',
      }
      toast(msgs[code ?? ''] ?? 'Erro ao exportar pacote.', 'error')
    }
  }

  const { data: templates } = useTemplates(true)
  const { data: rotinas } = useRotinas(true)

  const templatesDoP = isManual
    ? (templates ?? []).filter((t) => !t.pacote_id || t.pacote_id === 'manual')
    : (templates ?? []).filter((t) => t.pacote_id === pacote.pacote_id)
  const rotinasDoP = isManual
    ? (rotinas ?? []).filter((r) => !r.pacote_id || r.pacote_id === 'manual')
    : (rotinas ?? []).filter((r) => r.pacote_id === pacote.pacote_id)

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
              {isManual ? (
                <Badge tone="neutral">Padrão</Badge>
              ) : pacote.licenciado ? (
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
          {!isManual && !pacote.licenciado && (
            <button
              type="button"
              onClick={handleExportar}
              disabled={exportar.isPending}
              className="text-text-secondary hover:text-accent transition-colors"
              aria-label="Baixar JSON do pacote"
              title="Baixar JSON para editar no ChatGPT"
            >
              {exportar.isPending ? <Spinner className="w-4 h-4" /> : <Download size={16} />}
            </button>
          )}
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
          {!isManual && (
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
          )}
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

// ── Aba de criação de pacote personalizado ────────────────────────────────────

function CriarPacoteTab() {
  const { data: pacotes } = usePacotes()
  const { data: templates, isLoading: loadingTmpl } = useTemplates(false)
  const { data: rotinas, isLoading: loadingRot } = useRotinas(false)
  const { data: biblioteca, isLoading: loadingBib } = useBiblioteca()
  const gerar = useGerarPacote()
  const gerarLicenciado = useGerarPacoteLicenciado()
  const { show: toast } = useToast()

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [autor, setAutor] = useState('')
  const [versao, setVersao] = useState('1.0')
  const [templatesSel, setTemplatesSel] = useState<Set<string>>(new Set())
  const [rotinasSel, setRotinasSel] = useState<Set<string>>(new Set())
  const [exerciciosSel, setExerciciosSel] = useState<Set<string>>(new Set())
  const [exQuery, setExQuery] = useState('')
  const [gruposFechados, setGruposFechados] = useState<Set<string>>(new Set())
  const [licenciadoMode, setLicenciadoMode] = useState(false)
  const [maxUsos, setMaxUsos] = useState(1)

  const licenciadoIds = new Set(
    (pacotes ?? []).filter((p) => p.licenciado).map((p) => p.pacote_id)
  )

  function isLicenciado(pacote_id?: string) {
    return !!pacote_id && pacote_id !== 'manual' && licenciadoIds.has(pacote_id)
  }

  // Bloqueia itens de origem licenciada (direta OU herdada via aplicar→salvar de aluno).
  function isBloqueado(item: { pacote_id?: string; origem_licenciada?: boolean }) {
    return !!item.origem_licenciada || isLicenciado(item.pacote_id)
  }

  function toggleSet(set: Set<string>, id: string): Set<string> {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  // Exercícios já incluídos implicitamente pelos treinos selecionados (derivado ao vivo:
  // desmarcar um template libera os exercícios dele). Matching por nome, igual ao backend.
  const nomesViaTreinos = useMemo(() => {
    const s = new Set<string>()
    for (const t of templates ?? []) {
      if (!templatesSel.has(t.template_id)) continue
      for (const ex of t.exercicios ?? []) {
        const nl = ex.nome?.trim().toLowerCase()
        if (nl) s.add(nl)
      }
    }
    return s
  }, [templates, templatesSel])

  function nomeLower(e: ExLib): string {
    return e.nome.trim().toLowerCase()
  }

  function isViaTreino(e: ExLib): boolean {
    return nomesViaTreinos.has(nomeLower(e))
  }

  // Exercícios da biblioteca: filtro por busca + agrupamento por grupo muscular
  const exerciciosFiltrados = useMemo(() => {
    const q = normalizeText(exQuery)
    const items = biblioteca ?? []
    if (!q) return items
    return items.filter(
      (e) => normalizeText(e.nome).includes(q)
        || gruposDoExercicio(e).some((g) => normalizeText(g).includes(q)),
    )
  }, [biblioteca, exQuery])

  const gruposExercicios = useMemo(() => {
    const map = new Map<string, ExLib[]>()
    for (const e of exerciciosFiltrados) {
      // Exercício multi-grupo aparece sob cada grupo — aqui a lista é para SELECIONAR o que
      // vai no pacote, e quem procura por "Tríceps" espera achar o supino ali também.
      for (const g of gruposDoExercicio(e)) {
        if (!map.has(g)) map.set(g, [])
        map.get(g)!.push(e)
      }
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
  }, [exerciciosFiltrados])

  function selecionarExercicios(items: ExLib[], marcar: boolean) {
    setExerciciosSel((prev) => {
      const next = new Set(prev)
      for (const e of items) {
        if (isBloqueado(e) || isViaTreino(e)) continue
        if (marcar) next.add(e.exlib_id)
        else next.delete(e.exlib_id)
      }
      return next
    })
  }

  // Selecionar todas as rotinas elegíveis marca também os treinos delas (mesmo efeito
  // cascata do checkbox individual de rotina).
  function selecionarRotinas(items: typeof rotinas, marcar: boolean) {
    const elegiveis = (items ?? []).filter((r) => !isBloqueado(r))
    setRotinasSel((prev) => {
      const next = new Set(prev)
      for (const r of elegiveis) {
        if (marcar) next.add(r.rotina_id)
        else next.delete(r.rotina_id)
      }
      return next
    })
    if (marcar) {
      setTemplatesSel((prev) => {
        const next = new Set(prev)
        for (const r of elegiveis) {
          for (const tid of r.template_ids ?? []) {
            const tpl = templates?.find((t) => t.template_id === tid)
            if (tpl && !isBloqueado(tpl)) next.add(tid)
          }
        }
        return next
      })
    }
  }

  const bibliotecaById = useMemo(() => {
    const m = new Map<string, ExLib>()
    for (const e of biblioteca ?? []) m.set(e.exlib_id, e)
    return m
  }, [biblioteca])

  // Avulsos efetivos: seleção manual menos os já cobertos pelos treinos (dedup por nome,
  // espelhando o backend — o payload vai limpo, sem redundância)
  const avulsosEfetivos = useMemo(() => {
    const vistos = new Set<string>()
    const ids: string[] = []
    for (const id of exerciciosSel) {
      const e = bibliotecaById.get(id)
      if (!e) continue
      const nl = nomeLower(e)
      if (nomesViaTreinos.has(nl) || vistos.has(nl)) continue
      vistos.add(nl)
      ids.push(id)
    }
    return ids
  }, [exerciciosSel, bibliotecaById, nomesViaTreinos])   // eslint-disable-line react-hooks/exhaustive-deps

  const totalExerciciosPacote = nomesViaTreinos.size + avulsosEfetivos.length

  const baseBody = {
    nome: nome.trim(),
    descricao: descricao.trim(),
    autor: autor.trim(),
    versao: versao.trim() || '1.0',
    template_ids: [...templatesSel],
    rotina_ids: [...rotinasSel],
    exlib_ids: avulsosEfetivos,
  }

  const errMsgs: Record<string, string> = {
    PACOTE_LICENCIADO_NAO_PERMITIDO: 'Um dos itens selecionados pertence a um pacote licenciado.',
    TEMPLATE_NAO_ENCONTRADO: 'Template não encontrado.',
    ROTINA_NAO_ENCONTRADA: 'Rotina não encontrada.',
    EXERCICIO_NAO_ENCONTRADO: 'Exercício não encontrado na biblioteca.',
    SELECAO_VAZIA: 'Selecione ao menos um template, rotina ou exercício.',
    PACOTE_SECRET_NAO_CONFIGURADO: 'Configuração do servidor incompleta. Contate o suporte.',
  }

  async function handleGerar() {
    if (!nome.trim()) return
    try {
      if (licenciadoMode) {
        const data = await gerarLicenciado.mutateAsync({ ...baseBody, max_usos: maxUsos })
        downloadJson(data, `${nome.trim()}.cpkg`)
        toast('Pacote licenciado gerado! Distribua o arquivo .cpkg para seus clientes.', 'success')
      } else {
        const data = await gerar.mutateAsync(baseBody)
        downloadJson(data, `${nome.trim()}.json`)
        toast('JSON gerado! Cole no ChatGPT para editar ou importe diretamente.', 'success')
      }
    } catch (err) {
      const { code } = extrairErroImport(err)
      toast(errMsgs[code ?? ''] ?? mensagemDeErro(err, 'Erro ao gerar pacote.'), 'error')
    }
  }

  const isPending = gerar.isPending || gerarLicenciado.isPending
  const isLoading = loadingTmpl || loadingRot

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <p className="text-sm font-medium">Metadados do pacote</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-text-secondary mb-1 block">Nome *</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Treino Funcional Iniciante"
              className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-secondary mb-1 block">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Breve descrição do pacote"
              className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Autor</label>
            <input
              value={autor}
              onChange={(e) => setAutor(e.target.value)}
              placeholder="Seu nome"
              className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Versão</label>
            <input
              value={versao}
              onChange={(e) => setVersao(e.target.value)}
              placeholder="1.0"
              className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <div className="pt-1 border-t border-border">
          <button
            type="button"
            onClick={() => setLicenciadoMode((v) => !v)}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${licenciadoMode ? 'text-accent' : 'text-text-secondary hover:text-text'}`}
          >
            {licenciadoMode ? <Lock size={15} /> : <Unlock size={15} />}
            {licenciadoMode ? 'Licenciado (token de uso único)' : 'Gerar como licenciado'}
          </button>
          {licenciadoMode && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Usos disponíveis</label>
                <input
                  type="number"
                  min={1}
                  value={maxUsos}
                  onChange={(e) => setMaxUsos(Math.max(1, Number(e.target.value)))}
                  className="w-28 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <p className="text-xs text-text-secondary">
                O arquivo <span className="font-mono">.cpkg</span> gerado contém um token de uso único. Distribua-o para quem deve importar o pacote. Cada importação consome um uso.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-medium mb-1">
          Rotinas{' '}
          {rotinasSel.size > 0 && (
            <span className="text-xs text-accent ml-1">({rotinasSel.size} selecionada{rotinasSel.size > 1 ? 's' : ''})</span>
          )}
        </p>
        <p className="text-xs text-text-secondary mb-3">
          Selecionar uma rotina marca os treinos dela automaticamente — e os exercícios desses treinos entram no pacote (aparecem como "via treino" na seção abaixo).
        </p>
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : !rotinas || rotinas.length === 0 ? (
          <p className="text-xs text-text-secondary">Nenhuma rotina disponível.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 text-xs mb-2">
              <button
                type="button"
                onClick={() => selecionarRotinas(rotinas, true)}
                className="text-accent hover:underline"
              >
                Selecionar todas ({rotinas.filter((r) => !isBloqueado(r)).length})
              </button>
              {rotinasSel.size > 0 && (
                <button
                  type="button"
                  onClick={() => setRotinasSel(new Set())}
                  className="text-text-secondary hover:text-text hover:underline"
                >
                  Limpar seleção
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
            {rotinas.map((r) => {
              const bloqueado = isBloqueado(r)
              const selecionado = rotinasSel.has(r.rotina_id)
              return (
                <label
                  key={r.rotina_id}
                  className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer ${bloqueado ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-secondary'}`}
                >
                  <input
                    type="checkbox"
                    checked={selecionado}
                    disabled={bloqueado}
                    onChange={() => {
                      if (bloqueado) return
                      const novaRotinasSel = toggleSet(rotinasSel, r.rotina_id)
                      setRotinasSel(novaRotinasSel)
                      if (novaRotinasSel.has(r.rotina_id) && r.template_ids?.length) {
                        setTemplatesSel((prev) => {
                          const next = new Set(prev)
                          for (const tid of r.template_ids!) {
                            const tpl = templates?.find((t) => t.template_id === tid)
                            if (tpl && !isBloqueado(tpl)) next.add(tid)
                          }
                          return next
                        })
                      }
                    }}
                    className="accent-accent"
                  />
                  <span className="text-sm flex-1">{r.nome}</span>
                  {bloqueado && <Badge tone="accent" className="text-xs">Licenciado</Badge>}
                </label>
              )
            })}
            </div>
          </>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-medium mb-3">
          Templates{' '}
          {templatesSel.size > 0 && (
            <span className="text-xs text-accent ml-1">({templatesSel.size} selecionado{templatesSel.size > 1 ? 's' : ''})</span>
          )}
        </p>
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : !templates || templates.length === 0 ? (
          <p className="text-xs text-text-secondary">Nenhum template disponível.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 text-xs mb-2">
              <button
                type="button"
                onClick={() => setTemplatesSel(new Set(templates.filter((t) => !isBloqueado(t)).map((t) => t.template_id)))}
                className="text-accent hover:underline"
              >
                Selecionar todos ({templates.filter((t) => !isBloqueado(t)).length})
              </button>
              {templatesSel.size > 0 && (
                <button
                  type="button"
                  onClick={() => setTemplatesSel(new Set())}
                  className="text-text-secondary hover:text-text hover:underline"
                >
                  Limpar seleção
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
            {templates.map((t) => {
              const bloqueado = isBloqueado(t)
              const selecionado = templatesSel.has(t.template_id)
              return (
                <label
                  key={t.template_id}
                  className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer ${bloqueado ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-secondary'}`}
                >
                  <input
                    type="checkbox"
                    checked={selecionado}
                    disabled={bloqueado}
                    onChange={() => !bloqueado && setTemplatesSel(toggleSet(templatesSel, t.template_id))}
                    className="accent-accent"
                  />
                  <span className="text-sm flex-1">{t.nome}</span>
                  {bloqueado && <Badge tone="accent" className="text-xs">Licenciado</Badge>}
                </label>
              )
            })}
            </div>
          </>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-medium mb-1">
          Exercícios da biblioteca{' '}
          {(avulsosEfetivos.length > 0 || nomesViaTreinos.size > 0) && (
            <span className="text-xs text-accent ml-1">
              ({avulsosEfetivos.length} avulso{avulsosEfetivos.length === 1 ? '' : 's'}
              {nomesViaTreinos.size > 0 && ` + ${nomesViaTreinos.size} via treino${nomesViaTreinos.size === 1 ? '' : 's'}`})
            </span>
          )}
        </p>
        <p className="text-xs text-text-secondary mb-3">
          Adicione exercícios avulsos ao pacote — dá para gerar um pacote só de exercícios, sem treinos ou rotinas.
          Exercícios dos treinos selecionados já entram automaticamente (marcados como "via treino").
        </p>
        {loadingBib ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : !biblioteca || biblioteca.length === 0 ? (
          <p className="text-xs text-text-secondary">Nenhum exercício na biblioteca.</p>
        ) : (
          <div className="space-y-2">
            {/* Busca + ações em massa */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={exQuery}
                onChange={(e) => setExQuery(e.target.value)}
                placeholder="Buscar por nome ou grupo muscular…"
                className="w-full rounded-lg border border-border bg-surface-secondary pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => selecionarExercicios(exerciciosFiltrados, true)}
                className="text-accent hover:underline"
              >
                {(() => {
                  const n = exerciciosFiltrados.filter((e) => !isBloqueado(e) && !isViaTreino(e)).length
                  return `Selecionar todos${exQuery.trim() ? ` (${n} filtrados)` : ` (${n})`}`
                })()}
              </button>
              {exerciciosSel.size > 0 && (
                <button
                  type="button"
                  onClick={() => setExerciciosSel(new Set())}
                  className="text-text-secondary hover:text-text hover:underline"
                >
                  Limpar seleção
                </button>
              )}
            </div>

            {/* Grupos colapsáveis com checkbox de grupo */}
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {gruposExercicios.length === 0 && (
                <p className="text-xs text-text-muted py-2">Nenhum exercício corresponde à busca.</p>
              )}
              {gruposExercicios.map(([grupo, items]) => {
                const elegiveis = items.filter((e) => !isBloqueado(e) && !isViaTreino(e))
                const selecionadosNoGrupo = elegiveis.filter((e) => exerciciosSel.has(e.exlib_id)).length
                const viaTreinoNoGrupo = items.filter((e) => !isBloqueado(e) && isViaTreino(e)).length
                const noPacoteNoGrupo = selecionadosNoGrupo + viaTreinoNoGrupo
                const todosSel = elegiveis.length > 0 && selecionadosNoGrupo === elegiveis.length
                const parcial = selecionadosNoGrupo > 0 && !todosSel
                const fechado = gruposFechados.has(grupo)
                return (
                  <div key={grupo} className="rounded-lg border border-border">
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-surface-secondary/60 rounded-t-lg">
                      <input
                        type="checkbox"
                        checked={todosSel}
                        disabled={elegiveis.length === 0}
                        ref={(el) => { if (el) el.indeterminate = parcial }}
                        onChange={() => selecionarExercicios(items, !todosSel)}
                        className="accent-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setGruposFechados((prev) => toggleSet(prev, grupo))}
                        className="flex items-center gap-1.5 flex-1 text-left"
                      >
                        {fechado ? <ChevronRight size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                        <span className="text-sm font-medium">{grupo}</span>
                        <span className="text-xs text-text-muted">
                          {noPacoteNoGrupo}/{items.length} no pacote
                        </span>
                      </button>
                    </div>
                    {!fechado && (
                      <div className="py-0.5">
                        {items.map((e) => {
                          const bloqueado = isBloqueado(e)
                          const viaTreino = !bloqueado && isViaTreino(e)
                          const selecionado = viaTreino || exerciciosSel.has(e.exlib_id)
                          return (
                            <label
                              key={e.exlib_id}
                              className={`flex items-center gap-3 px-2 py-1 mx-1 rounded-lg ${bloqueado ? 'opacity-40 cursor-not-allowed' : viaTreino ? 'cursor-default' : 'cursor-pointer hover:bg-surface-secondary'}`}
                            >
                              <input
                                type="checkbox"
                                checked={selecionado}
                                disabled={bloqueado || viaTreino}
                                onChange={() => !bloqueado && !viaTreino && setExerciciosSel(toggleSet(exerciciosSel, e.exlib_id))}
                                className="accent-accent"
                              />
                              <span className="text-sm flex-1">{e.nome}</span>
                              {viaTreino && <Badge tone="info" className="text-xs">via treino</Badge>}
                              {bloqueado && <Badge tone="accent" className="text-xs">Licenciado</Badge>}
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {(templatesSel.size > 0 || rotinasSel.size > 0 || totalExerciciosPacote > 0) && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <span className="font-medium">Este pacote terá:</span>{' '}
          {rotinasSel.size} rotina{rotinasSel.size === 1 ? '' : 's'} · {templatesSel.size} treino{templatesSel.size === 1 ? '' : 's'} · {totalExerciciosPacote} exercício{totalExerciciosPacote === 1 ? '' : 's'}
          {totalExerciciosPacote > 0 && nomesViaTreinos.size > 0 && (
            <span className="text-text-secondary">
              {' '}({nomesViaTreinos.size} dos treinos{avulsosEfetivos.length > 0 ? ` + ${avulsosEfetivos.length} avulso${avulsosEfetivos.length === 1 ? '' : 's'}` : ''})
            </span>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleGerar}
          disabled={!nome.trim() || (templatesSel.size === 0 && rotinasSel.size === 0 && avulsosEfetivos.length === 0) || isPending}
        >
          {isPending ? (
            <span className="flex items-center gap-2"><Spinner className="w-4 h-4" /> Gerando...</span>
          ) : licenciadoMode ? (
            <span className="flex items-center gap-2"><Lock size={16} /> Gerar Pacote Licenciado (.cpkg)</span>
          ) : (
            <span className="flex items-center gap-2"><Download size={16} /> Gerar JSON do Pacote</span>
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function PacotesPage() {
  const [tab, setTab] = useState<'ia' | 'instalados' | 'criar' | 'arquivo'>('ia')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Package size={20} className="text-accent" />
        <h2 className="font-display text-xl font-semibold">Pacotes de treino</h2>
      </div>
      <p className="text-sm text-text-secondary mb-4">
        Você monta o treino, a IA escreve e cadastra pra você em segundos — o diferencial do
        CoachPilot. Ou importe um arquivo .cpkg licenciado.
      </p>

      <Tabs
        tabs={[
          { key: 'ia', label: 'Gerar com IA' },
          { key: 'instalados', label: 'Instalados' },
          { key: 'criar', label: 'Criar' },
          { key: 'arquivo', label: 'Importar arquivo (.cpkg)' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
        className="mb-4"
      />

      {tab === 'ia' && <ImportarIASection />}
      {tab === 'instalados' && <InstaladosTab />}
      {tab === 'criar' && <CriarPacoteTab />}
      {tab === 'arquivo' && <ImportarArquivoTab />}
    </div>
  )
}
