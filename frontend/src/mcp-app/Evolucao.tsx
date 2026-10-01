import { useEffect, useState } from 'react'
import { Activity, Sparkles, Trophy } from 'lucide-react'
import { GraficoArea } from './GraficoArea'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Select } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'
import type { Host } from './host'
import { Alert, fmtDate } from './ui'
import type { Evolucao as EvolucaoData, Programa } from './types'

const SEM_UNIDADE = 'unidade não informada'
const PERIODOS = [['30', '30 dias'], ['90', '90 dias'], ['', 'Tudo']] as const

export function Evolucao({ host, alunoId, programa, onAsk }: { host: Host; alunoId: string; programa: Programa; onAsk: (text: string) => Promise<void> }) {
  const exercicios = programa.treinos.flatMap(t => t.exercicios).filter((e, i, arr) => arr.findIndex(x => x.nome === e.nome) === i)
  const [nome, setNome] = useState(exercicios[0]?.nome || '')
  const [dias, setDias] = useState('90')
  const [metric, setMetric] = useState('carga_max')
  const [selectedUnit, setSelectedUnit] = useState('')
  const [data, setData] = useState<EvolucaoData>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ex = exercicios.find(e => e.nome === nome)
  useEffect(() => {
    if (!nome) return
    let active = true
    setLoading(true); setError('')
    void host.call('evolucao_exercicio', { aluno_id: alunoId, ...(ex?.origem_id ? { exercicio_id: ex.origem_id } : { chave: ex?.chave_historico || nome }), limit: 200 }).then(r => {
      if (active) { setData(r.structuredContent as unknown as EvolucaoData); setSelectedUnit(''); setMetric(ex?.tipo_exercicio === 'PERFORMANCE' ? 'metrica_max' : 'carga_max') }
    }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [host, alunoId, nome])

  if (!exercicios.length) return <EmptyState icon={<Activity />} title="Sem exercícios" description="O programa atual não tem exercícios para acompanhar." />

  const unidadeDe = (p: EvolucaoData['serie'][number]) => (metric === 'metrica_max' ? p.unidade_reps : p.unidade_carga) || SEM_UNIDADE
  const units = [...new Set((data?.serie || []).map(unidadeDe))]
  const unit = units.includes(selectedUnit) ? selectedUnit : units[0] || SEM_UNIDADE
  const cutoff = new Date(Date.now() - Number(dias) * 86400000).toISOString()
  const points = (data?.serie || []).filter(p => (!dias || p.data >= cutoff) && unidadeDe(p) === unit)
    .map(p => ({ data: p.data, valor: p[metric as 'carga_max'] })).filter(p => p.valor != null && Number.isFinite(p.valor)) as { data: string; valor: number }[]
  const recorde = points.length ? Math.max(...points.map(p => p.valor)) : null
  const legenda = metric === 'volume' ? 'Volume por sessão' : metric === 'metrica_max' ? 'Melhor métrica por sessão' : 'Carga máxima por sessão'

  return <div className="space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Select label="Exercício" aria-label="Exercício" value={nome} onChange={e => setNome(e.target.value)}>{exercicios.map(e => <option key={e.nome}>{e.nome}</option>)}</Select>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Métrica" aria-label="Métrica" value={metric} onChange={e => { setMetric(e.target.value); setSelectedUnit('') }}>
          {ex?.tipo_exercicio === 'PERFORMANCE' ? <option value="metrica_max">Melhor métrica</option> : <><option value="carga_max">Carga máxima</option><option value="volume">Volume</option></>}
        </Select>
        <Select label="Unidade" aria-label="Unidade" value={unit} onChange={e => setSelectedUnit(e.target.value)}>{units.length ? units.map(u => <option key={u}>{u}</option>) : <option>{SEM_UNIDADE}</option>}</Select>
      </div>
    </div>
    <div role="radiogroup" aria-label="Período" className="flex gap-1">
      {PERIODOS.map(([v, l]) => <Button key={v} role="radio" aria-checked={dias === v} size="sm" variant={dias === v ? 'primary' : 'outline'} onClick={() => setDias(v)}>{l}</Button>)}
    </div>
    {loading ? <div className="py-8 flex justify-center"><Spinner /></div>
      : error ? <Alert tone="danger" role="alert">{error}</Alert>
      : <>
        <Card variant="elevated">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-sm text-text-secondary">{legenda} <span className="text-text-muted">({unit})</span></p>
            {recorde != null && unit !== SEM_UNIDADE && <Badge tone="warning"><Trophy size={12} /> PR {recorde.toLocaleString('pt-BR')}</Badge>}
          </div>
          {unit === SEM_UNIDADE
            ? <p className="text-sm text-text-muted">Estes registros antigos não informam a unidade. Confira os valores na tabela; o gráfico precisa de uma unidade registrada.</p>
            : !points.length ? <p className="text-sm text-text-muted">Sem registros com esta métrica no período.</p>
            : <div role="img" aria-label={`Evolução em ${unit}, de ${Math.min(...points.map(p => p.valor))} a ${recorde}. Valores na tabela abaixo.`}>
              <GraficoArea pontos={points.map(p => ({ rotulo: fmtDate(p.data)?.slice(0, 5) ?? '', valor: p.valor }))} unidade={unit} />
            </div>}
        </Card>
        <Card variant="elevated" className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <caption className="text-left text-xs text-text-muted px-4 pt-3 pb-2">{points.length} registro{points.length === 1 ? '' : 's'} de {nome} em {unit} · até os últimos 200, sem estimar ausentes</caption>
            <thead><tr className="text-xs text-text-muted border-b border-border"><th scope="col" className="text-left font-medium px-4 py-2">Data</th><th scope="col" className="text-right font-medium px-4 py-2">Valor ({unit})</th></tr></thead>
            <tbody>{[...points].reverse().map((p, i) => <tr key={i} className="border-b border-border last:border-b-0"><td className="px-4 py-2 text-text-secondary">{fmtDate(p.data)}</td><td className="px-4 py-2 text-right font-medium">{p.valor}</td></tr>)}</tbody>
          </table>
        </Card>
      </>}
    <Button variant="outline" size="sm" onClick={() => void onAsk(`Analise a evolução de ${nome} do aluno_id=${alunoId} no período de ${dias || 'todos os'} dias, usando os dados atuais e a unidade ${unit}. Explique a cobertura e sugira ajustes para minha revisão.`)}>
      <Sparkles size={14} /> Analisar evolução na conversa
    </Button>
  </div>
}
