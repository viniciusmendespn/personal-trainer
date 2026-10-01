import { useEffect, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, CalendarCheck, ClipboardList, Clock, Lock, TrendingUp } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { Host } from './host'
import { formatValue } from './presentation'
import { unpack } from './useCases'
import { Alert, SectionTitle, fmtDate, tempoRelativo } from './ui'
import type { Contexto } from './types'

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone: string }) {
  return <Card variant="elevated" className="flex items-start gap-3">
    <div className={`p-2 rounded-lg ${tone} [&>svg]:w-5 [&>svg]:h-5`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="font-display text-xl font-bold text-text mt-0.5 truncate">{value}</p>
    </div>
  </Card>
}

export function Indicadores({ contexto }: { contexto: Contexto }) {
  const e = contexto.estatisticas_treino
  const ultimo = e?.ultimo_treino_em
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <Stat icon={<CalendarCheck />} tone="bg-accent/15 text-accent-hover" label="Nesta semana" value={e?.sessoes_semana_atual ?? '—'} />
    <Stat icon={<TrendingUp />} tone="bg-energy/15 text-energy" label="Média semanal" value={e?.media_sessoes_por_semana?.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) ?? '—'} />
    <Stat icon={<Activity />} tone="bg-success/15 text-success" label="Sessões totais" value={e?.total_sessoes ?? '—'} />
    <Stat icon={<Clock />} tone="bg-warning/15 text-warning" label="Último treino" value={ultimo ? tempoRelativo(ultimo) : '—'} />
  </div>
}

export function Restricoes({ contexto }: { contexto: Contexto }) {
  const dores = contexto.dores_e_duvidas.filter(x => x.tipo === 'DOR')
  const semAnamnese = contexto.secoes_indisponiveis.includes('anamnese')
  const semDores = contexto.secoes_indisponiveis.includes('dores_duvidas')
  return <Card variant="elevated" className={dores.length ? 'border-warning/40' : ''}>
    <SectionTitle icon={<AlertTriangle size={16} />}>Saúde e restrições informadas</SectionTitle>
    {semDores ? <Alert tone="warning">Não foi possível carregar dores e dúvidas. Confira antes de prescrever.</Alert>
      : dores.length ? <ul className="space-y-2 mb-3">{dores.map((r, i) => <li key={i} className="text-sm">
          <span className="font-medium text-warning">Dor relatada{r.exercicio ? ` em ${r.exercicio}` : ''}</span>
          {r.data && <span className="text-xs text-text-muted"> · {fmtDate(r.data)}</span>}
          <p className="text-text-secondary">{r.descricao}</p>
        </li>)}</ul>
      : <p className="text-sm text-text-muted mb-3">Nenhuma dor relatada.</p>}
    <div className="border-t border-border pt-3">
      <p className="text-xs font-semibold text-text-secondary flex items-center gap-1.5 mb-2"><ClipboardList size={13} /> Anamnese{contexto.anamnese?.preenchido_em ? ` · respondida em ${fmtDate(contexto.anamnese.preenchido_em)}` : ''}</p>
      {semAnamnese ? <Alert tone="warning">Não foi possível carregar a anamnese. Confira antes de prescrever.</Alert>
        : contexto.anamnese?.respostas.length ? <dl className="space-y-2">{contexto.anamnese.respostas.map((r, i) => <div key={i}>
            <dt className="text-xs text-text-muted">{r.pergunta}</dt><dd className="text-sm text-text">{r.resposta}</dd>
          </div>)}</dl>
        : <p className="text-xs text-text-muted">O aluno ainda não respondeu a anamnese.</p>}
    </div>
  </Card>
}

/** Dados completos só sob pedido: não entram no contexto até o personal clicar. */
export function DadosPrivados({ host, alunoId, version }: { host: Host; alunoId: string; version: () => number }) {
  const [data, setData] = useState<Record<string, unknown>>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    const v = version(); setBusy(true); setError('')
    try { const r = await host.call('detalhar_aluno', { aluno_id: alunoId }); if (v === version()) setData(r.structuredContent) }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar.') } finally { setBusy(false) }
  }
  const campos = data ? Object.entries(data).filter(([k, v]) => v != null && v !== '' && !['aluno_id', 'aviso_seguranca'].includes(k)) : []
  return <Card variant="elevated">
    <SectionTitle icon={<Lock size={16} />} aside={!data && <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>{busy ? 'Carregando…' : 'Carregar dados privados'}</Button>}>Dados completos do aluno</SectionTitle>
    {!data && <p className="text-xs text-text-muted">Contato, anotações e anamnese completa. Carregue só quando precisar revisar.</p>}
    {error && <Alert tone="danger" role="alert">{error}</Alert>}
    {data && <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">{campos.map(([k, v]) => <div key={k} className="min-w-0">
      <dt className="text-xs text-text-muted">{k.replaceAll('_', ' ')}</dt><dd className="text-sm text-text break-words">{formatValue(v)}</dd>
    </div>)}</dl>}
  </Card>
}

export function RestricoesDaProposta({ host, alunoId }: { host: Host; alunoId: string }) {
  const [contexto, setContexto] = useState<Contexto>()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void host.call('mostrar_aluno', { aluno_id: alunoId }).then(r => { if (active) setContexto(unpack(r).detalhes.contexto_aluno) })
      .catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [host, alunoId])
  if (contexto) return <Restricoes contexto={contexto} />
  return error ? <Alert tone="warning">Não foi possível carregar as restrições. Confira os dados do aluno.</Alert>
    : <p className="text-sm text-text-muted">Carregando restrições informadas…</p>
}
