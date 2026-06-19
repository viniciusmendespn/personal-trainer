import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Scale, FileDown, X, Paperclip, Trash2 } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAluno } from '../hooks/useAlunos'
import { useAvaliacoes, useCreateAvaliacao, useDeleteAvaliacao } from '../hooks/useDominio'
import { uploadAvaliacaoFile } from '../api/avaliacoes'
import { Button, Card, Input, SearchableSelect, Textarea, Spinner, Modal, EmptyState, useToast, useConfirm } from '../components/ui'
import { RelatorioPrintLayout } from '../components/pdf/RelatorioPrintLayout'
import { renderNodeToPdf } from '../utils/exportPdf'
import type { Avaliacao } from '../types'

const chartTip = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  color: 'var(--color-text)',
  fontSize: 12,
}
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 12 }

const PRESET_BIO_FIELDS = ['Massa muscular (kg)', '% Água corporal', 'Gordura visceral', 'Massa óssea (kg)', 'Taxa metabólica basal (kcal)']

type MetricOption = { value: string; label: string; unidade?: string }

/** Junta peso/% gordura (fixos), chaves de bioimpedância e métricas customizadas num único catálogo de métricas selecionáveis. */
function buildMetricOptions(avs: Avaliacao[] | undefined): MetricOption[] {
  const options: MetricOption[] = [
    { value: 'peso', label: 'Peso (kg)', unidade: 'kg' },
    { value: 'percentual_gordura', label: '% Gordura', unidade: '%' },
  ]
  const seenMedidas = new Set<string>()
  const seenMetricas = new Map<string, string>()
  avs?.forEach((a) => {
    if (a.medidas) Object.keys(a.medidas).forEach((k) => seenMedidas.add(k))
    a.metricas?.forEach((m) => { if (!seenMetricas.has(m.nome)) seenMetricas.set(m.nome, m.unidade) })
  })
  seenMedidas.forEach((k) => options.push({ value: `medida:${k}`, label: k }))
  seenMetricas.forEach((unidade, nome) => options.push({ value: `metrica:${nome}`, label: unidade ? `${nome} (${unidade})` : nome, unidade }))
  return options
}

function resolveMetricValue(a: Avaliacao, key: string): number | undefined {
  if (key === 'peso') return a.peso
  if (key === 'percentual_gordura') return a.percentual_gordura
  if (key.startsWith('medida:')) {
    const v = a.medidas?.[key.slice('medida:'.length)]
    return typeof v === 'number' ? v : undefined
  }
  if (key.startsWith('metrica:')) {
    const nome = key.slice('metrica:'.length)
    return a.metricas?.find((m) => m.nome === nome)?.valor
  }
  return undefined
}

/** Série temporal (data x valor) de cada métrica disponível — usado no PDF, que mostra todas de uma vez. */
function buildMetricSeries(avsSorted: Avaliacao[], options: MetricOption[]) {
  return options
    .map((opt) => ({
      nome: opt.label,
      unidade: opt.unidade,
      pontos: avsSorted
        .map((a) => {
          const valor = resolveMetricValue(a, opt.value)
          return valor == null ? null : { data: a.data ?? a.created_at, valor }
        })
        .filter((p): p is { data: string; valor: number } => p !== null),
    }))
    .filter((m) => m.pontos.length > 1)
}

type Delta = { peso?: number; percentual_gordura?: number; metricas: Record<string, number> }

/** Variação de cada métrica vs. a avaliação cronologicamente anterior, por avaliacao_id. */
function buildDeltas(avsSorted: Avaliacao[]): Map<string, Delta> {
  const map = new Map<string, Delta>()
  let prevPeso: number | undefined
  let prevGordura: number | undefined
  const prevMetricas = new Map<string, number>()
  for (const a of avsSorted) {
    const d: Delta = { metricas: {} }
    if (a.peso != null && prevPeso != null) d.peso = a.peso - prevPeso
    if (a.percentual_gordura != null && prevGordura != null) d.percentual_gordura = a.percentual_gordura - prevGordura
    a.metricas?.forEach((m) => {
      const prev = prevMetricas.get(m.nome)
      if (prev != null) d.metricas[m.nome] = m.valor - prev
    })
    map.set(a.avaliacao_id, d)
    if (a.peso != null) prevPeso = a.peso
    if (a.percentual_gordura != null) prevGordura = a.percentual_gordura
    a.metricas?.forEach((m) => prevMetricas.set(m.nome, m.valor))
  }
  return map
}

function DeltaBadge({ delta, unidade }: { delta?: number; unidade?: string }) {
  if (delta == null || delta === 0) return null
  const up = delta > 0
  return (
    <span className={`inline-flex items-center gap-0.5 ${up ? 'text-success' : 'text-danger'}`}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}{unidade ?? ''}
    </span>
  )
}

export function AvaliacoesPage() {
  const { alunoId = '' } = useParams()
  const { data: aluno } = useAluno(alunoId)
  const { data: avs, isLoading } = useAvaliacoes(alunoId)
  const deleteAvaliacao = useDeleteAvaliacao(alunoId)
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const { show } = useToast()

  const avsSorted = useMemo(
    () => [...(avs ?? [])].sort((a, b) => (a.data ?? a.created_at).localeCompare(b.data ?? b.created_at)),
    [avs]
  )
  const metricOptions = useMemo(() => buildMetricOptions(avs), [avs])
  const deltas = useMemo(() => buildDeltas(avsSorted), [avsSorted])
  const nomesMetricasConhecidos = useMemo(() => {
    const nomes = new Set<string>()
    avs?.forEach((a) => a.metricas?.forEach((m) => nomes.add(m.nome)))
    return Array.from(nomes)
  }, [avs])

  const [metricaSelecionada, setMetricaSelecionada] = useState('peso')
  const metricaAtual = metricOptions.find((o) => o.value === metricaSelecionada) ?? metricOptions[0]

  const chart = avsSorted
    .map((a) => ({
      data: new Date(a.data ?? a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      valor: resolveMetricValue(a, metricaSelecionada),
    }))
    .filter((p) => p.valor != null)

  async function exportarPdf() {
    if (!avs?.length) return
    setExporting(true)
    try {
      await renderNodeToPdf(
        <RelatorioPrintLayout
          alunoNome={aluno?.nome ?? 'Aluno'}
          avaliacoes={[...avs]
            .sort((a, b) => (b.data ?? b.created_at).localeCompare(a.data ?? a.created_at))
            .map((a) => ({ data: a.data ?? a.created_at, peso: a.peso, percentual_gordura: a.percentual_gordura }))}
          metricas={buildMetricSeries(avsSorted, metricOptions)}
        />,
        `avaliacoes-${aluno?.nome ?? 'aluno'}.pdf`
      )
    } catch {
      show('Não foi possível gerar o PDF.', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function excluirAvaliacao(a: Avaliacao) {
    if (!a.ts_id) return
    const ok = await confirm({
      title: 'Excluir avaliação',
      message: `Excluir a avaliação de ${new Date(a.data ?? a.created_at).toLocaleDateString('pt-BR')}? Essa ação não pode ser desfeita.`,
      tone: 'danger',
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    try {
      await deleteAvaliacao.mutateAsync(a.ts_id)
    } catch {
      show('Não foi possível excluir a avaliação.', 'error')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to={`/alunos/${alunoId}`} className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text mb-4">
        <ArrowLeft size={16} /> {aluno?.nome ?? 'Aluno'}
      </Link>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="font-display text-xl font-semibold">Avaliação física</h2>
        <div className="flex items-center gap-2">
          {!!avs?.length && (
            <Button variant="outline" size="sm" onClick={exportarPdf} disabled={exporting}>
              <span className="flex items-center gap-1"><FileDown size={14} /> {exporting ? 'Gerando…' : 'PDF'}</span>
            </Button>
          )}
          <Button onClick={() => setOpen(true)}><span className="flex items-center gap-1"><Plus size={16} /> Nova</span></Button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova avaliação" size="lg">
        <NovaAvaliacaoForm alunoId={alunoId} nomesMetricasConhecidos={nomesMetricasConhecidos} onDone={() => setOpen(false)} />
      </Modal>

      <Modal open={!!lightbox} onClose={() => setLightbox(null)} title="Foto">
        {lightbox && <img src={lightbox} alt="Foto da avaliação" className="w-full rounded-lg" />}
      </Modal>

      {chart.length > 1 && (
        <Card variant="elevated" className="mb-4">
          <p className="text-sm text-text-secondary mb-2">Evolução no tempo</p>
          <SearchableSelect
            options={metricOptions}
            value={metricaSelecionada}
            onChange={setMetricaSelecionada}
            placeholder="Buscar métrica…"
            className="mb-3 max-w-xs"
          />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chart} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="metricaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-energy)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-energy)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="data" tick={axisTick} stroke="var(--color-border-strong)" />
              <YAxis tick={axisTick} stroke="var(--color-border-strong)" domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={chartTip} formatter={(v: number) => [`${v}${metricaAtual?.unidade ?? ''}`, metricaAtual?.label ?? '']} />
              <Area type="monotone" dataKey="valor" stroke="var(--color-energy)" strokeWidth={2.5}
                fill="url(#metricaGradient)" dot={{ r: 3, fill: 'var(--color-energy)' }} name={metricaAtual?.label} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : !avs?.length ? (
        <EmptyState icon={<Scale />} title="Nenhuma avaliação ainda" description="Registre a primeira avaliação física do aluno." action={<Button onClick={() => setOpen(true)}>Nova avaliação</Button>} />
      ) : (
        <div className="space-y-2">
          {[...avs].sort((a, b) => (b.data ?? b.created_at).localeCompare(a.data ?? a.created_at)).map((a) => (
            <AvaliacaoRow key={a.avaliacao_id} a={a} delta={deltas.get(a.avaliacao_id)} onVerFoto={setLightbox} onExcluir={excluirAvaliacao} />
          ))}
        </div>
      )}
    </div>
  )
}

function AvaliacaoRow({
  a, delta, onVerFoto, onExcluir,
}: { a: Avaliacao; delta?: Delta; onVerFoto: (url: string) => void; onExcluir: (a: Avaliacao) => void }) {
  const [showDetails, setShowDetails] = useState(false)
  const temDetalhes = !!(a.observacoes || (a.medidas && Object.keys(a.medidas).length) || a.metricas?.length)

  return (
    <Card variant="elevated">
      <div className="flex items-center justify-between gap-2">
        <button className="flex-1 flex items-center justify-between text-sm text-left" onClick={() => setShowDetails((v) => !v)} disabled={!temDetalhes}>
          <span className="flex items-center gap-1.5">
            {new Date(a.data ?? a.created_at).toLocaleDateString('pt-BR')}
            {a.bio_scan_url && <Paperclip size={12} className="text-accent-hover" />}
          </span>
          <span className="text-text-secondary flex items-center gap-1.5">
            {a.peso != null && (
              <span className="flex items-center gap-1">{a.peso} kg <DeltaBadge delta={delta?.peso} unidade="kg" /></span>
            )}
            {a.percentual_gordura != null && (
              <span className="flex items-center gap-1">· {a.percentual_gordura}% <DeltaBadge delta={delta?.percentual_gordura} unidade="%" /></span>
            )}
          </span>
        </button>
        <Button type="button" variant="ghost" size="sm" iconOnly aria-label="Excluir avaliação" onClick={() => onExcluir(a)} className="hover:text-danger shrink-0">
          <Trash2 size={14} />
        </Button>
      </div>

      {!!a.fotos_urls?.length && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {a.fotos_urls.map((url, i) => (
            <button key={i} onClick={() => onVerFoto(url)} className="shrink-0">
              <img src={url} alt="" className="w-12 h-12 object-cover rounded border border-border" />
            </button>
          ))}
        </div>
      )}

      {a.bio_scan_url && (
        <div className="mt-2">
          <a href={a.bio_scan_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-hover hover:underline">
            <Paperclip size={12} /> Ver anexo da bioimpedância
          </a>
        </div>
      )}

      {showDetails && temDetalhes && (
        <div className="mt-3 space-y-2 text-xs text-text-secondary border-t border-border pt-3">
          {a.observacoes && <p className="whitespace-pre-wrap">{a.observacoes}</p>}
          {a.medidas && Object.keys(a.medidas).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(a.medidas).map(([k, v]) => (
                <span key={k} className="bg-white/5 rounded-full px-2 py-1">{k}: <b className="text-text">{String(v)}</b></span>
              ))}
            </div>
          )}
          {!!a.metricas?.length && (
            <div className="flex flex-wrap gap-2">
              {a.metricas.map((m) => (
                <span key={m.nome} className="bg-white/5 rounded-full px-2 py-1 flex items-center gap-1">
                  {m.nome}: <b className="text-text">{m.valor}{m.unidade}</b>
                  <DeltaBadge delta={delta?.metricas[m.nome]} unidade={m.unidade} />
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function NovaAvaliacaoForm({
  alunoId, nomesMetricasConhecidos, onDone,
}: { alunoId: string; nomesMetricasConhecidos: string[]; onDone: () => void }) {
  const create = useCreateAvaliacao(alunoId)
  const { show } = useToast()
  const [peso, setPeso] = useState('')
  const [gordura, setGordura] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [bioFields, setBioFields] = useState<{ label: string; value: string }[]>(
    PRESET_BIO_FIELDS.map((label) => ({ label, value: '' }))
  )
  const [metricas, setMetricas] = useState<{ nome: string; unidade: string; valor: string }[]>([])
  const [fotos, setFotos] = useState<File[]>([])
  const [bioAnexo, setBioAnexo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  function updateBioField(i: number, value: string) {
    setBioFields((fs) => fs.map((f, j) => (j === i ? { ...f, value } : f)))
  }
  function updateBioLabel(i: number, label: string) {
    setBioFields((fs) => fs.map((f, j) => (j === i ? { ...f, label } : f)))
  }
  function removeBioField(i: number) {
    setBioFields((fs) => fs.filter((_, j) => j !== i))
  }
  function addBioField() {
    setBioFields((fs) => [...fs, { label: '', value: '' }])
  }

  function updateMetrica(i: number, patch: Partial<{ nome: string; unidade: string; valor: string }>) {
    setMetricas((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  }
  function removeMetrica(i: number) {
    setMetricas((ms) => ms.filter((_, j) => j !== i))
  }
  function addMetrica() {
    setMetricas((ms) => [...ms, { nome: '', unidade: '', valor: '' }])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const fotos_s3_keys = await Promise.all(fotos.map((f) => uploadAvaliacaoFile(alunoId, f)))
      const bio_scan_s3_key = bioAnexo ? await uploadAvaliacaoFile(alunoId, bioAnexo) : undefined
      const medidas: Record<string, unknown> = {}
      for (const f of bioFields) {
        if (f.label.trim() && f.value.trim()) {
          const n = Number(f.value.replace(',', '.'))
          medidas[f.label.trim()] = Number.isFinite(n) ? n : f.value.trim()
        }
      }
      const metricasPayload = metricas
        .filter((m) => m.nome.trim() && m.valor.trim())
        .map((m) => ({
          nome: m.nome.trim(),
          unidade: m.unidade.trim().slice(0, 10),
          valor: Number(m.valor.replace(',', '.')),
        }))
        .filter((m) => Number.isFinite(m.valor))
      await create.mutateAsync({
        peso: peso ? Number(peso) : undefined,
        percentual_gordura: gordura ? Number(gordura) : undefined,
        observacoes: observacoes || undefined,
        medidas: Object.keys(medidas).length ? medidas : undefined,
        metricas: metricasPayload.length ? metricasPayload : undefined,
        fotos_s3_keys: fotos_s3_keys.length ? fotos_s3_keys : undefined,
        bio_scan_s3_key,
      })
      onDone()
    } catch {
      show('Não foi possível salvar a avaliação.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Peso (kg)" value={peso} onChange={(e) => setPeso(e.target.value)} />
        <Input label="% Gordura" value={gordura} onChange={(e) => setGordura(e.target.value)} />
      </div>
      <Textarea label="Observações" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />

      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Bioimpedância (opcional)</p>
        <div className="space-y-2">
          {bioFields.map((f, i) => (
            <div key={i} className="flex gap-2 items-end">
              {PRESET_BIO_FIELDS.includes(f.label) ? (
                <Input className="flex-1" value={f.label} disabled />
              ) : (
                <Input className="flex-1" placeholder="Nome do campo" value={f.label} onChange={(e) => updateBioLabel(i, e.target.value)} />
              )}
              <Input className="w-28" placeholder="Valor" value={f.value} onChange={(e) => updateBioField(i, e.target.value)} />
              <Button type="button" variant="ghost" size="sm" iconOnly aria-label="Remover campo" onClick={() => removeBioField(i)} className="hover:text-danger">
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addBioField}>
          <span className="flex items-center gap-1"><Plus size={14} /> Adicionar campo</span>
        </Button>
      </div>

      <div>
        <p className="text-xs font-medium text-text-secondary mb-2">Métricas customizadas (opcional)</p>
        <datalist id="metricas-conhecidas">
          {nomesMetricasConhecidos.map((n) => <option key={n} value={n} />)}
        </datalist>
        <div className="space-y-2">
          {metricas.map((m, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Input
                className="flex-1" placeholder="Nome do campo" value={m.nome} list="metricas-conhecidas"
                onChange={(e) => updateMetrica(i, { nome: e.target.value })}
              />
              <Input
                className="w-20" placeholder="Unidade" maxLength={10} value={m.unidade}
                onChange={(e) => updateMetrica(i, { unidade: e.target.value })}
              />
              <Input
                className="w-24" placeholder="Valor" value={m.valor}
                onChange={(e) => updateMetrica(i, { valor: e.target.value })}
              />
              <Button type="button" variant="ghost" size="sm" iconOnly aria-label="Remover métrica" onClick={() => removeMetrica(i)} className="hover:text-danger">
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addMetrica}>
          <span className="flex items-center gap-1"><Plus size={14} /> Adicionar campo</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-text-secondary mb-1">Fotos (comparação na timeline)</span>
          <input
            type="file" accept="image/*" multiple
            onChange={(e) => setFotos(Array.from(e.target.files ?? []))}
            className="w-full text-xs text-text-secondary file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-surface file:text-text file:cursor-pointer"
          />
          {fotos.length > 0 && <p className="text-[11px] text-text-muted mt-1">{fotos.length} foto(s) selecionada(s)</p>}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-text-secondary mb-1">Anexo da bio (imagem ou PDF)</span>
          <input
            type="file" accept="image/*,application/pdf"
            onChange={(e) => setBioAnexo(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-text-secondary file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-surface file:text-text file:cursor-pointer"
          />
          {bioAnexo && <p className="text-[11px] text-text-muted mt-1">{bioAnexo.name}</p>}
        </label>
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}
