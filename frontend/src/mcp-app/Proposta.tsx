import { useState } from 'react'
import { AlertTriangle, ArrowRight, Pencil, XCircle } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { agruparDiferencas, formatValue, labels, resumoDiferencas, type GrupoDiferenca, type TipoGrupo } from './presentation'
import { ProgramaView, prescricao } from './Programa'
import type { Achado, Exercicio, Programa, Proposta, Serie, Treino } from './types'

const TIPO_LABEL: Record<TipoGrupo, string> = { adicionado: 'Incluído', removido: 'Removido', alterado: 'Ajustado', reordenado: 'Mudou de posição' }

/** "O que mudou": uma unidade de revisão por exercício, agrupada por treino. */
export function Diferencas({ proposta }: { proposta: Proposta }) {
  const [soMudancas, setSoMudancas] = useState(true)
  const grupos = agruparDiferencas(proposta)
  const porTreino = [...new Set(grupos.map(g => g.treino))].map(t => [t, grupos.filter(g => g.treino === t)] as const)
  const preservados = proposta.programa.treinos.filter(t => !grupos.some(g => g.treino === t.nome)).length
  return <section className="space-y-3">
    <div role="radiogroup" aria-label="Comparação" className="inline-flex rounded-lg border border-border p-0.5 bg-surface">
      {[[true, 'O que mudou'], [false, 'Programa completo']].map(([v, l]) => <button key={String(v)} type="button" role="radio" aria-checked={soMudancas === v}
        onClick={() => setSoMudancas(v as boolean)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${soMudancas === v ? 'bg-accent text-white' : 'text-text-secondary hover:text-text'}`}>{l as string}</button>)}
    </div>
    {soMudancas
      ? grupos.length ? <>
          <p className="text-xs text-text-secondary">{resumoDiferencas(grupos)}{preservados ? ` · ${preservados} treino${preservados > 1 ? 's' : ''} sem mudança` : ''}.</p>
          {porTreino.map(([treino, gs]) => <Card key={treino} variant="elevated" className="!p-0 overflow-hidden">
            <h3 className="font-display text-sm font-semibold px-4 pt-3 pb-1">{treino}</h3>
            <ul className="divide-y divide-border">{gs.map(g => <GrupoCard key={g.chave} g={g} />)}</ul>
          </Card>)}
        </>
        : <p className="text-sm text-text-muted">Nenhuma alteração na prescrição.</p>
      : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div><h3 className="font-display text-sm font-semibold mb-2 text-text-secondary">Atual</h3><ProgramaView programa={proposta.programa_base} /></div>
        <div><h3 className="font-display text-sm font-semibold mb-2 text-accent-hover">Proposto</h3><ProgramaView programa={proposta.programa} /></div>
      </div>}
  </section>
}

function GrupoCard({ g }: { g: GrupoDiferenca }) {
  const inteiro = !g.exercicio && (g.tipo === 'adicionado' || g.tipo === 'removido')
  const titulo = g.exercicio ?? (inteiro ? `Treino ${g.tipo === 'adicionado' ? 'novo' : 'retirado do programa'}` : 'Dados do treino')
  return <li className="px-4 py-3">
    <div className="flex items-center gap-2 flex-wrap mb-1.5">
      <span className={`font-medium ${g.tipo === 'removido' && !inteiro ? 'line-through text-text-secondary' : ''}`}>{titulo}</span>
      <Badge tone={g.tipo === 'removido' ? 'neutral' : 'accent'}>{TIPO_LABEL[g.tipo]}</Badge>
    </div>
    {g.tipo === 'adicionado' || g.tipo === 'removido'
      ? <Valor v={g.item} ex={g.item as Exercicio} />
      : <dl className="space-y-2">{g.campos.map((d, i) => <div key={i}>
          <dt className="text-[11px] text-text-muted mb-0.5">{d.campo === 'ordem' ? 'Posição no treino' : labels[d.campo!] ?? d.campo}</dt>
          <dd className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-x-2 gap-y-0.5 items-start">
            <div className="min-w-0 text-text-secondary"><span className="sm:hidden text-[11px] text-text-muted">Atual: </span>{d.campo === 'ordem' ? <p className="text-sm">{Number(d.atual) + 1}º</p> : <Valor v={d.atual} ex={g.exAtual} />}</div>
            <ArrowRight size={14} className="hidden sm:block text-text-muted mt-1" aria-hidden="true" />
            <div className="min-w-0"><span className="sm:hidden text-[11px] text-text-muted">Proposto: </span>{d.campo === 'ordem' ? <p className="text-sm">{Number(d.proposto) + 1}º</p> : <Valor v={d.proposto} ex={g.exProposto} />}</div>
          </dd>
        </div>)}</dl>}
  </li>
}

/** Mostra o valor de uma diferença na linguagem do portal: treino vira lista de exercícios,
 *  exercício e séries viram "3 × 10 reps · 20 kg" — com as unidades do próprio exercício. */
function Valor({ v, ex }: { v: unknown; ex?: Exercicio }) {
  if (v == null || v === '') return <p className="text-sm text-text-muted">—</p>
  if (Array.isArray(v) && v.every(x => x && typeof x === 'object' && 'series' in x)) {
    const base = ex ?? { tipo_exercicio: 'FORCA' } as Exercicio
    return <p className="text-sm text-text">{prescricao({ ...base, series_prescritas: v as Serie[] }).join(' / ') || '—'}</p>
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
    return <p className="text-sm"><span className="text-xs text-text-secondary">{prescricao(e).join(' / ') || 'Prescrição pelo bloco'}</span>{e.intervalo_s ? <span className="text-xs text-text-muted"> · {e.intervalo_s}s de intervalo</span> : null}</p>
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
