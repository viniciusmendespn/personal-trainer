import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Scale, FileDown, X, Paperclip } from 'lucide-react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAluno } from '../hooks/useAlunos'
import { useAvaliacoes, useCreateAvaliacao } from '../hooks/useDominio'
import { uploadAvaliacaoFile } from '../api/avaliacoes'
import { Button, Card, Input, Textarea, Spinner, Modal, EmptyState, useToast } from '../components/ui'
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

export function AvaliacoesPage() {
  const { alunoId = '' } = useParams()
  const { data: aluno } = useAluno(alunoId)
  const { data: avs, isLoading } = useAvaliacoes(alunoId)
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const { show } = useToast()

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
        />,
        `avaliacoes-${aluno?.nome ?? 'aluno'}.pdf`
      )
    } catch {
      show('Não foi possível gerar o PDF.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const [metricaAtiva, setMetricaAtiva] = useState<string | null>(null)

  const metricasDisponiveis = useMemo(() => {
    const keys = new Set<string>()
    avs?.forEach((a) => {
      if (a.percentual_gordura != null) keys.add('percentual_gordura')
      if (a.medidas) Object.keys(a.medidas).forEach((k) => keys.add(k))
    })
    return Array.from(keys)
  }, [avs])

  const avsSorted = useMemo(
    () => [...(avs ?? [])].sort((a, b) => (a.data ?? a.created_at).localeCompare(b.data ?? b.created_at)),
    [avs]
  )

  const chart = avsSorted
    .filter((a) => a.peso != null)
    .map((a) => ({
      data: new Date(a.data ?? a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      peso: a.peso,
      metrica: metricaAtiva === 'percentual_gordura'
        ? a.percentual_gordura
        : metricaAtiva
          ? (a.medidas?.[metricaAtiva] as number | undefined) ?? null
          : null,
    }))

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
        <NovaAvaliacaoForm alunoId={alunoId} onDone={() => setOpen(false)} />
      </Modal>

      <Modal open={!!lightbox} onClose={() => setLightbox(null)} title="Foto">
        {lightbox && <img src={lightbox} alt="Foto da avaliação" className="w-full rounded-lg" />}
      </Modal>

      {chart.length > 1 && (
        <Card variant="elevated" className="mb-4">
          <p className="text-sm text-text-secondary mb-2">Peso ao longo do tempo</p>
          {metricasDisponiveis.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {metricasDisponiveis.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetricaAtiva((prev) => prev === m ? null : m)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    metricaAtiva === m
                      ? 'bg-accent/20 border-accent/50 text-accent-hover'
                      : 'border-border text-text-secondary hover:border-accent/30'
                  }`}
                >
                  {m === 'percentual_gordura' ? '% Gordura' : m}
                </button>
              ))}
            </div>
          )}
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chart} margin={{ top: 5, right: metricaAtiva ? 20 : 10, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="pesoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-energy)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-energy)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="data" tick={axisTick} stroke="var(--color-border-strong)" />
              <YAxis yAxisId="left" tick={axisTick} stroke="var(--color-border-strong)" domain={['dataMin - 2', 'dataMax + 2']} />
              {metricaAtiva && (
                <YAxis yAxisId="right" orientation="right" tick={axisTick} stroke="var(--color-accent)" />
              )}
              <Tooltip contentStyle={chartTip} />
              <Area yAxisId="left" type="monotone" dataKey="peso" stroke="var(--color-energy)" strokeWidth={2.5}
                fill="url(#pesoGradient)" dot={{ r: 3, fill: 'var(--color-energy)' }} name="Peso (kg)" />
              {metricaAtiva && (
                <Line yAxisId="right" type="monotone" dataKey="metrica" stroke="var(--color-accent)" strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-accent)' }} name={metricaAtiva === 'percentual_gordura' ? '% Gordura' : metricaAtiva} connectNulls />
              )}
            </ComposedChart>
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
            <AvaliacaoRow key={a.avaliacao_id} a={a} onVerFoto={setLightbox} />
          ))}
        </div>
      )}
    </div>
  )
}

function AvaliacaoRow({ a, onVerFoto }: { a: Avaliacao; onVerFoto: (url: string) => void }) {
  const [showDetails, setShowDetails] = useState(false)
  const temDetalhes = !!(a.observacoes || (a.medidas && Object.keys(a.medidas).length))

  return (
    <Card variant="elevated">
      <button className="w-full flex items-center justify-between text-sm text-left" onClick={() => setShowDetails((v) => !v)} disabled={!temDetalhes}>
        <span className="flex items-center gap-1.5">
          {new Date(a.data ?? a.created_at).toLocaleDateString('pt-BR')}
          {a.bio_scan_url && <Paperclip size={12} className="text-accent-hover" />}
        </span>
        <span className="text-text-secondary">
          {a.peso != null ? `${a.peso} kg` : ''} {a.percentual_gordura != null ? `· ${a.percentual_gordura}%` : ''}
        </span>
      </button>

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
        </div>
      )}
    </Card>
  )
}

function NovaAvaliacaoForm({ alunoId, onDone }: { alunoId: string; onDone: () => void }) {
  const create = useCreateAvaliacao(alunoId)
  const { show } = useToast()
  const [peso, setPeso] = useState('')
  const [gordura, setGordura] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [bioFields, setBioFields] = useState<{ label: string; value: string }[]>(
    PRESET_BIO_FIELDS.map((label) => ({ label, value: '' }))
  )
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
      await create.mutateAsync({
        peso: peso ? Number(peso) : undefined,
        percentual_gordura: gordura ? Number(gordura) : undefined,
        observacoes: observacoes || undefined,
        medidas: Object.keys(medidas).length ? medidas : undefined,
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
