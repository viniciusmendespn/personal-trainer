import { useState } from 'react'
import { Pencil, XCircle, AlertTriangle } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { formatValue, labels } from './presentation'
import { ProgramaView, prescricao } from './Programa'
import type { Achado, Diferenca, Exercicio, Programa, Proposta, Serie, Treino } from './types'

const tipoTone: Record<string, 'success' | 'danger' | 'accent'> = { adicionado: 'success', removido: 'danger', alterado: 'accent' }

export function Diferencas({ proposta }: { proposta: Proposta }) {
  const [soMudancas, setSoMudancas] = useState(true)
  return <section className="space-y-3">
    <div role="radiogroup" aria-label="Comparação" className="inline-flex rounded-lg border border-border p-0.5 bg-surface">
      {[[true, 'Somente alterações'], [false, 'Programa completo']].map(([v, l]) => <button key={String(v)} type="button" role="radio" aria-checked={soMudancas === v}
        onClick={() => setSoMudancas(v as boolean)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${soMudancas === v ? 'bg-accent text-white' : 'text-text-secondary hover:text-text'}`}>{l as string}</button>)}
    </div>
    {soMudancas
      ? proposta.diferencas.length ? proposta.diferencas.map((d, i) => <DiferencaCard key={`${d.caminho}-${i}`} d={d} />)
        : <p className="text-sm text-text-muted">Nenhuma alteração na prescrição.</p>
      : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div><h3 className="font-display text-sm font-semibold mb-2 text-text-secondary">Atual</h3><ProgramaView programa={proposta.programa_base} /></div>
        <div><h3 className="font-display text-sm font-semibold mb-2 text-accent-hover">Proposto</h3><ProgramaView programa={proposta.programa} /></div>
      </div>}
  </section>
}

function DiferencaCard({ d }: { d: Diferenca }) {
  const campo = labels[d.campo || ''] || (d.caminho.includes('exercicios') ? 'Exercício' : 'Treino')
  const unico = d.tipo === 'adicionado' || d.tipo === 'removido'
  return <Card variant="elevated">
    <div className="flex items-center gap-2 flex-wrap mb-2">
      <span className={`font-medium ${d.tipo === 'removido' ? 'line-through text-text-secondary' : ''}`}>{d.nome}</span><Badge tone={tipoTone[d.tipo] ?? 'neutral'}>{d.tipo}</Badge>
      <span className="text-xs text-text-muted">{campo}</span>
    </div>
    {unico
      ? <div className={`rounded-lg border px-3 py-2 ${d.tipo === 'adicionado' ? 'border-success/30 bg-success/5' : 'border-danger/25 bg-danger/5'}`}><Valor v={d.tipo === 'adicionado' ? d.proposto : d.atual} /></div>
      : <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 min-w-0"><p className="text-[11px] text-text-muted mb-0.5">Atual</p><Valor v={d.atual} /></div>
        <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 min-w-0"><p className="text-[11px] text-text-muted mb-0.5">Proposto</p><Valor v={d.proposto} /></div>
      </div>}
  </Card>
}

/** Mostra o valor de uma diferença na linguagem do portal: treino vira lista de exercícios,
 *  exercício e séries viram "3 × 10 reps · 20 kg" — nunca o despejo campo: valor. */
function Valor({ v }: { v: unknown }) {
  if (v == null || v === '') return <p className="text-sm text-text-muted">—</p>
  if (Array.isArray(v) && v.every(x => x && typeof x === 'object' && 'series' in x)) {
    return <p className="text-sm text-text">{prescricao({ series_prescritas: v as Serie[] } as Exercicio).join(' / ') || '—'}</p>
  }
  if (typeof v === 'object' && v && Array.isArray((v as Treino).exercicios)) {
    const t = v as Treino
    return <div className="text-sm">
      {t.foco && <p className="text-xs text-text-muted mb-1">{t.foco}</p>}
      {t.exercicios.length ? <ol className="space-y-0.5">{t.exercicios.map((e, i) => <li key={i} className="flex gap-2">
        <span className="text-[10px] font-mono text-text-muted w-4 text-center pt-1">{i + 1}</span>
        <span className="min-w-0"><span className="font-medium">{e.nome}</span> <span className="text-xs text-text-secondary">{prescricao(e).join(' / ')}</span></span>
      </li>)}</ol> : <p className="text-text-muted">Sem exercícios.</p>}
    </div>
  }
  if (typeof v === 'object' && v && 'nome' in v && 'tipo_exercicio' in v) {
    const e = v as Exercicio
    return <p className="text-sm"><span className="font-medium">{e.nome}</span> <span className="text-xs text-text-secondary">{prescricao(e).join(' / ')}</span></p>
  }
  return <p className="text-sm text-text break-words">{formatValue(v)}</p>
}

export function Validacao({ erros, avisos }: { erros: Achado[]; avisos: Achado[] }) {
  return <>
    {[['Erros que impedem a aplicação', erros, 'danger'], ['Avisos para revisão', avisos, 'warning']].map(([titulo, itens, tom]) => (itens as Achado[]).length ? <Card key={titulo as string} variant="elevated" className={tom === 'danger' ? 'border-danger/40' : 'border-warning/40'}>
      <h3 className={`font-display text-sm font-semibold flex items-center gap-2 mb-2 ${tom === 'danger' ? 'text-danger' : 'text-warning'}`}>{tom === 'danger' ? <XCircle size={16} /> : <AlertTriangle size={16} />}{titulo as string}</h3>
      <ul className="space-y-1.5">{(itens as Achado[]).map((e, i) => <li key={i} className="text-sm text-text">{e.onde && <span className="font-medium">{e.onde}: </span>}{e.mensagem}{e.correcao && <p className="text-xs text-text-muted">{e.correcao}</p>}</li>)}</ul>
    </Card> : null)}
  </>
}

export function EditorPrograma({ programa, onChange, disabled, errors }: { programa: Programa; onChange: (p: Programa) => void; disabled: boolean; errors: Achado[] }) {
  function change(fn: (p: Programa) => void) { const copy = structuredClone(programa); fn(copy); onChange(copy) }
  function field(path: string, label: string, value: string | number | null | undefined, update: (value: string) => void, type = 'text') {
    const error = errors.find(x => (x.campo || x.caminho) === path)
    return <div key={path}>
      <Input label={label} type={type} value={value ?? ''} disabled={disabled} min={type === 'number' ? 0 : undefined} onChange={e => update(e.target.value)}
        aria-invalid={!!error} className={error ? 'border-danger' : ''} />
      {error && <p className="text-xs text-danger mt-1">{error.mensagem}</p>}
    </div>
  }
  return <details className="group rounded-xl border border-border bg-surface">
    <summary className="cursor-pointer list-none px-4 py-3 font-medium text-sm flex items-center gap-2"><Pencil size={14} className="text-accent-hover" />Editar proposta</summary>
    <div className="px-4 pb-4 space-y-4">{programa.treinos.map((t, ti) => <fieldset key={ti} className="space-y-3">
      <legend className="font-display font-semibold text-sm mb-2">{t.nome}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {field(`treinos[${ti}].data_inicio`, 'Início da vigência', t.data_inicio, v => change(p => { p.treinos[ti].data_inicio = v || null }), 'date')}
        {field(`treinos[${ti}].data_fim`, 'Fim da vigência', t.data_fim, v => change(p => { p.treinos[ti].data_fim = v || null }), 'date')}
        {field(`treinos[${ti}].observacoes`, 'Observações do treino', t.observacoes, v => change(p => { p.treinos[ti].observacoes = v || null }))}
      </div>
      {t.exercicios.map((e, ei) => <div key={ei} className="rounded-lg border border-border p-3 space-y-3">
        <p className="text-sm font-medium">{e.nome}</p>
        {t.blocos.length || e.bloco_id ? <p className="text-xs text-text-muted">Para alterar a prescrição deste bloco, use “Pedir ajuste”.</p>
          : e.series_prescritas?.map((s, si) => <div key={si} className="grid grid-cols-3 gap-2">
            {field(`treinos[${ti}].exercicios[${ei}].series_prescritas[${si}].series`, `Séries (grupo ${si + 1})`, s.series, v => change(p => { p.treinos[ti].exercicios[ei].series_prescritas![si].series = Number(v) }), 'number')}
            {field(`treinos[${ti}].exercicios[${ei}].series_prescritas[${si}].reps`, `${e.tipo_exercicio === 'PERFORMANCE' ? 'Métrica' : 'Repetições'} ${e.unidade_reps || ''}`.trim(), s.reps, v => change(p => { p.treinos[ti].exercicios[ei].series_prescritas![si].reps = v }))}
            {field(`treinos[${ti}].exercicios[${ei}].series_prescritas[${si}].carga`, `Carga ${e.unidade_carga || ''}`.trim(), s.carga, v => change(p => { p.treinos[ti].exercicios[ei].series_prescritas![si].carga = v || null }))}
          </div>)}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {field(`treinos[${ti}].exercicios[${ei}].intervalo_s`, 'Intervalo (segundos)', e.intervalo_s, v => change(p => { p.treinos[ti].exercicios[ei].intervalo_s = v === '' ? null : Number(v) }), 'number')}
          {field(`treinos[${ti}].exercicios[${ei}].observacoes`, 'Observações do exercício', e.observacoes, v => change(p => { p.treinos[ti].exercicios[ei].observacoes = v || null }))}
        </div>
      </div>)}
    </fieldset>)}</div>
  </details>
}
