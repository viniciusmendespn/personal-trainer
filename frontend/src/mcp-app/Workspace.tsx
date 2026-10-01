import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Clock, Maximize2, RotateCcw, Search, Sparkles, Users } from 'lucide-react'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input, Select } from '../components/ui/Input'
import { SkeletonCard } from '../components/ui/Skeleton'
import { Spinner } from '../components/ui/Spinner'
import { StatChip } from '../components/ui/StatChip'
import { Tabs } from '../components/ui/Tabs'
import { ToolError, type Host } from './host'
import { CoachPilot, unpack } from './useCases'
import { estadoLabel, ordenarAlunos } from './presentation'
import { Alert, Brand, fmtDateTime, statusAluno, tempoRelativo } from './ui'
import { DadosPrivados, Indicadores, Restricoes, RestricoesDaProposta } from './Aluno'
import { ProgramaView } from './Programa'
import { Evolucao } from './Evolucao'
import { Diferencas, EditorPrograma, Validacao } from './Proposta'
import type { Aluno, Carteira, Detalhes, Operacao, Programa, Resumo, ToolResult } from './types'

const FILTROS = [['', 'Todos'], ['SEM_TREINO_VIGENTE', 'Sem treino vigente'], ['VENCIDOS', 'Vencidos'], ['PROXIMOS', 'Vencendo'], ['SEM_TREINAR', 'Sem treinar']] as const

export function Workspace({ host }: { host: Host }) {
  const api = useMemo(() => new CoachPilot(host), [host])
  const [ready, setReady] = useState(false)
  const [theme, setTheme] = useState('light')
  const [mode, setMode] = useState('inline')
  const [expanded, setExpanded] = useState(false)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [details, setDetails] = useState<Detalhes>({})
  const selectionVersion = useRef(0)
  const [carteira, setCarteira] = useState<Carteira | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  const [ordem, setOrdem] = useState(host.preferences?.().ordem || 'urgencia')
  const [tab, setTab] = useState('geral')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const [pending, setPending] = useState<ToolResult | null>(null)
  const [operation, setOperation] = useState<Operacao | null>(null)
  const [confirmSession, setConfirmSession] = useState(false)
  const [sessionRequired, setSessionRequired] = useState(false)

  // Os tokens do portal valem a partir do <html> (fundo, barra de rolagem).
  useEffect(() => { document.documentElement.dataset.theme = theme; document.body.dataset.mode = mode }, [theme, mode])

  function receive(result: ToolResult) {
    if (result.isError) { setError(result.content?.map(x => x.text).join('\n') || 'Não foi possível carregar.'); return }
    const data = unpack(result)
    if (!data.resumo?.tela) return
    if (dirtyRef.current) { setPending(result); setNotice('Há uma atualização disponível. Salve ou descarte suas edições antes de abrir.'); return }
    selectionVersion.current += 1
    setResumo(data.resumo); setDetails(data.detalhes); setError(''); setOperation(null)
    setSessionRequired(false); setConfirmSession(false); setTab('geral')
    if (data.resumo.tela === 'carteira') setCarteira(result._meta?.coachpilot as unknown as Carteira)
    void host.context({ aluno_id: data.resumo.aluno_id, nome: data.resumo.nome,
      proposta_id: data.resumo.proposta_id, revisao: data.resumo.revisao, tela: data.resumo.tela }).catch(() => {
        setNotice('A seleção está aberta. Identifique o aluno pelo nome e ID ao pedir um ajuste na conversa.')
      })
  }

  useEffect(() => {
    let active = true
    void host.connect(r => { if (active) receive(r) }, (t, m) => { if (!active) return; if (t) setTheme(t); if (m) setMode(m) })
      .then(() => { if (active) setReady(true) }).catch(err => { if (active) setError(String(err.message ?? err)) })
    return () => { active = false; host.dispose() }
  }, [host]) // Resultados externos nunca apagam edições locais.

  useEffect(() => {
    if (!ready || resumo) return
    void host.call('abrir_coachpilot', {}).then(receive).catch(err => setError(err.message))
  }, [ready])

  useEffect(() => {
    if (!ready || resumo?.tela !== 'carteira' || (!expanded && mode === 'inline')) return
    let active = true
    const timer = setTimeout(() => {
      setBusy(true)
      void host.call(resumo?.carteira_tool || 'listar_alunos', { busca, filtro: filtro || null, limit: 50 })
        .then(r => { if (active) setCarteira(r.structuredContent as unknown as Carteira) })
        .catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setBusy(false) })
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [ready, resumo?.tela, resumo?.carteira_tool, busca, filtro, expanded, mode, host])

  async function run(task: () => Promise<void>) {
    setBusy(true); setError('')
    try { await task() } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível concluir. Tente novamente.') }
    finally { setBusy(false) }
  }
  /** Sair do card: abre em tela cheia quando o host permite; senão expande no próprio chat. */
  function abrir() { setExpanded(true); void host.expand().catch(() => {}) }
  async function openAluno(id: string) {
    await run(async () => { const data = await api.aluno(id); receive({ structuredContent: data.resumo as unknown as Record<string, unknown>, _meta: { coachpilot: data.detalhes } }); abrir() })
  }
  async function back() {
    if (dirty) { setNotice('Salve ou descarte as edições da proposta para navegar.'); return }
    if (resumo?.tela === 'proposta' && resumo.aluno_id) { await openAluno(resumo.aluno_id); return }
    const data = await host.call('abrir_coachpilot', { busca, filtro: filtro || null })
    receive(data); setExpanded(true)
  }
  async function ask(text: string) { await run(() => host.ask(text)) }
  function edit(programa: Programa) {
    if (!details.proposta) return
    dirtyRef.current = true; setDirty(true); setNotice('Alterações não salvas')
    setDetails({ ...details, proposta: { ...details.proposta, programa } })
  }
  async function save() {
    if (!details.proposta) return
    await run(async () => {
      const data = await api.salvar(details.proposta!)
      dirtyRef.current = false; setDirty(false); setNotice('Proposta salva')
      receive({ structuredContent: data.resumo as unknown as Record<string, unknown>, _meta: { coachpilot: data.detalhes } })
    })
  }
  async function discard(alunoId: string, propostaId: string) {
    await run(async () => {
      const r = await api.proposta(alunoId, propostaId)
      dirtyRef.current = false; setDirty(false); setNotice('Edições descartadas')
      receive({ structuredContent: r.resumo as unknown as Record<string, unknown>, _meta: { coachpilot: r.detalhes } })
    })
  }
  async function apply() {
    const p = details.proposta
    if (!p || dirty) return
    await run(async () => {
      try {
        const op = await api.aplicar(p, confirmSession)
        if (op.status !== 'aplicado') throw new Error('Aplicação ainda não confirmada. Consulte a operação novamente.')
        setOperation(op); setDetails({ ...details, proposta: { ...p, estado: 'aplicada', operation_id: op.operation_id } })
        setNotice(''); setSessionRequired(false)
        await host.context({ aluno_id: p.aluno_id, proposta_id: p.proposta_id, revisao: op.revisao_resultante, tela: 'aplicada' }).catch(() => {})
      } catch (err) {
        if (err instanceof ToolError && (err.detail?.code === 'SESSAO_EM_ANDAMENTO' || /SESSAO_EM_ANDAMENTO/.test(err.message))) setSessionRequired(true)
        if (err instanceof ToolError && (err.detail?.code === 'REVISAO_DESATUALIZADA' || err.detail?.code === 'PROPOSTA_NAO_APLICAVEL')) {
          setDetails({ ...details, proposta: { ...p, estado: 'desatualizada' } })
        }
        throw err
      }
    })
  }
  async function restore() {
    const p = details.proposta
    if (!p?.operation_id) return
    await run(async () => {
      try {
        const r = await host.call('desfazer_alteracao_treino', { aluno_id: p.aluno_id, operation_id: p.operation_id, confirmar_sessao_em_andamento: confirmSession })
        setNotice(''); setOperation(r.structuredContent as unknown as Operacao)
        setDetails({ ...details, proposta: { ...p, estado: 'descartada' } })
      } catch (err) {
        if (err instanceof ToolError && /SESSAO_EM_ANDAMENTO/.test(err.message)) setSessionRequired(true)
        throw err
      }
    })
  }

  const isCard = mode === 'inline' && !expanded
  const p = details.proposta
  const canEdit = !!(resumo?.propostas_disponiveis && p && ['valida', 'invalida', 'rascunho'].includes(p.estado))
  const status = ready ? (resumo?.somente_leitura ? 'Somente leitura' : 'Conectado') : 'Conectando'

  return <main data-theme={theme} aria-busy={busy} className={`font-sans text-text text-sm leading-relaxed ${isCard ? 'p-4 bg-surface' : 'min-h-screen'}`}>
    {isCard ? <div className="flex items-center justify-between gap-2 mb-3">
      <Brand />
      <Badge tone={resumo?.somente_leitura ? 'neutral' : 'success'}><span role="status">{status}</span></Badge>
    </div> : <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-xl">
      <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-2">
        <Brand>{busy && <Spinner className="w-4 h-4 border-[1.5px] ml-1" />}</Brand>
        <div className="flex items-center gap-2">
          <Badge tone={resumo?.somente_leitura ? 'neutral' : 'success'}><span role="status">{status}</span></Badge>
          {mode !== 'fullscreen' && <Button variant="ghost" size="sm" iconOnly aria-label="Abrir tela cheia" onClick={() => void host.expand().catch(err => setError(err.message))}><Maximize2 size={16} /></Button>}
        </div>
      </div>
    </header>}

    <div className={isCard ? 'space-y-3' : 'max-w-3xl mx-auto px-4 py-4 space-y-4'}>
      {error && <Alert tone="danger" role="alert" onClose={() => setError('')}>{error}</Alert>}
      <p role="status" className={notice ? 'text-xs text-text-secondary' : 'sr-only'}>{busy ? (dirty ? 'Salvando…' : 'Carregando…') : notice}</p>
      {pending && !dirty && <Button variant="outline" size="sm" onClick={() => { const r = pending; setPending(null); receive(r) }}><RotateCcw size={14} /> Abrir atualização disponível</Button>}

      {!resumo && !error && <div className="space-y-3"><p className="text-text-secondary">{ready ? 'Carregando sua carteira…' : 'Aguardando a conexão autenticada.'}</p><SkeletonCard /></div>}

      {resumo && isCard && <ResumoCard resumo={resumo} details={details} carteira={carteira} busy={busy} onOpen={abrir} onAluno={id => void openAluno(id)} />}

      {resumo && !isCard && <>
        {resumo.tela === 'carteira' && <CarteiraView carteira={carteira} busy={busy} busca={busca} setBusca={setBusca} filtro={filtro} setFiltro={setFiltro}
          ordem={ordem} setOrdem={o => { setOrdem(o); host.savePreferences?.({ ordem: o }) }} onAluno={id => void openAluno(id)}
          onMore={() => void run(async () => {
            const r = await host.call(resumo.carteira_tool || 'listar_alunos', { busca, filtro: filtro || null, limit: 50, cursor: carteira!.next_cursor })
            const next = r.structuredContent as unknown as Carteira
            setCarteira({ ...next, items: [...carteira!.items, ...next.items].filter((a, i, arr) => arr.findIndex(b => b.aluno_id === a.aluno_id) === i) })
          })} />}

        {resumo.tela !== 'carteira' && <div>
          <button type="button" onClick={() => void run(back)} disabled={busy} className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text mb-3 disabled:opacity-50">
            <ArrowLeft size={16} />{resumo.tela === 'proposta' ? 'Aluno' : 'Alunos'}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={resumo.nome || '?'} size="lg" />
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold truncate">{resumo.nome || 'Aluno'}</h2>
                {p ? <Badge tone={p.estado === 'aplicada' ? 'success' : p.estado === 'valida' ? 'accent' : p.estado === 'invalida' ? 'danger' : 'neutral'} className="mt-1">{estadoLabel(p.estado)}</Badge>
                  : <div className="flex flex-wrap gap-1 mt-1">{details.contexto_aluno?.perfil.objetivos.length
                    ? details.contexto_aluno.perfil.objetivos.map(o => <StatChip key={o} tone="accent">{o}</StatChip>)
                    : <span className="text-xs text-text-muted">Objetivo não informado</span>}</div>}
              </div>
            </div>
            {resumo.tela === 'aluno' && resumo.propostas_disponiveis && details.programa && <Button disabled={busy} onClick={() => void ask(`Leia o guia de prescrição, o contexto atualizado e o programa do aluno ${resumo.nome} (aluno_id=${resumo.aluno_id}). ${details.programa!.treinos.length ? 'Prepare uma proposta de revisão do programa' : 'Monte o primeiro programa e pergunte apenas os dados essenciais ausentes'}. Salve uma proposta para minha revisão, preservando os treinos não solicitados.`)}>
              <Sparkles size={15} />{details.programa.treinos.length ? 'Pedir revisão do programa' : 'Montar primeiro programa'}
            </Button>}
          </div>
          {details.sessao_em_andamento && <div className="mt-3"><Alert tone="warning">Aluno treinando agora{details.sessao_em_andamento.treino_nome ? `: ${details.sessao_em_andamento.treino_nome}` : ''}.</Alert></div>}
        </div>}

        {resumo.tela === 'aluno' && details.programa && <>
          <Tabs tabs={[{ key: 'geral', label: 'Visão geral' }, { key: 'treinos', label: 'Treinos', badge: details.programa.treinos.length }, { key: 'evolucao', label: 'Evolução' }]} active={tab} onChange={setTab} />
          {tab === 'geral' && <div className="space-y-4">
            {details.contexto_aluno && <><Indicadores contexto={details.contexto_aluno} /><Restricoes contexto={details.contexto_aluno} /></>}
            <DadosPrivados host={host} alunoId={resumo.aluno_id!} version={() => selectionVersion.current} />
            <p className="text-[11px] text-text-muted">Dados consultados {details.contexto_aluno?.gerado_em ? `em ${fmtDateTime(details.contexto_aluno.gerado_em)}` : 'agora'}{resumo.revisao != null && ` · revisão ${resumo.revisao} do programa`}.</p>
          </div>}
          {tab === 'treinos' && <div className="space-y-3">
            <ProgramaView programa={details.programa} />
            {resumo.propostas_disponiveis && <Button variant="outline" size="sm" onClick={() => void ask(`Prepare uma alteração para o programa do aluno ${resumo.nome} (aluno_id=${resumo.aluno_id}), consulte o guia e os dados atuais e salve uma proposta para eu revisar.`)}><Sparkles size={14} /> Preparar alteração</Button>}
          </div>}
          {tab === 'evolucao' && <Evolucao host={host} alunoId={resumo.aluno_id!} programa={details.programa} onAsk={ask} />}
        </>}

        {resumo.tela === 'proposta' && p && <section className="space-y-4">
          <Card variant="elevated">
            <p className="text-text">{p.resumo_da_mudanca}</p>
            <p className="text-xs text-text-muted mt-1">Revisão da proposta {p.revisao} · sobre a revisão {p.revisao_base} do programa · atualizada em {fmtDateTime(p.updated_at)}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <StatChip tone="accent">{p.diferencas.length} alteraç{p.diferencas.length === 1 ? 'ão' : 'ões'}</StatChip>
              {!!p.validacao.erros.length && <StatChip tone="warning">{p.validacao.erros.length} erro{p.validacao.erros.length > 1 ? 's' : ''}</StatChip>}
              {!!p.validacao.avisos.length && <StatChip>{p.validacao.avisos.length} aviso{p.validacao.avisos.length > 1 ? 's' : ''}</StatChip>}
            </div>
          </Card>
          <RestricoesDaProposta host={host} alunoId={p.aluno_id} />
          <Diferencas proposta={p} />
          <Validacao erros={p.validacao.erros} avisos={p.validacao.avisos} />
          {canEdit && <EditorPrograma programa={p.programa} disabled={busy} errors={p.validacao.erros} onChange={edit} />}
          {sessionRequired && <Alert tone="warning">
            <p>O aluno está treinando agora. Ele pode terminar, mas a execução não conta no programa substituído.</p>
            <label className="flex items-center gap-2 mt-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[var(--color-accent)]" checked={confirmSession} onChange={e => setConfirmSession(e.target.checked)} />Aplicar mesmo com o aluno treinando</label>
          </Alert>}
          {operation && <Alert tone="success" role="status">
            <p className="font-medium">{p.estado === 'descartada' ? 'Programa restaurado' : 'Programa aplicado'} em {fmtDateTime(operation.aplicado_em)}.</p>
            <p className="text-xs text-text-muted">Revisão {operation.revisao_resultante} · operação {operation.operation_id}</p>
          </Alert>}
          <footer className="sticky bottom-0 -mx-4 px-4 py-3 border-t border-border bg-bg/90 backdrop-blur-xl flex flex-wrap gap-2">
            {['desatualizada', 'expirada'].includes(p.estado) && <Button variant="outline" disabled={busy} onClick={() => void openAluno(p.aluno_id)}>Ver programa atual</Button>}
            {canEdit && <Button variant="outline" disabled={busy || !dirty} onClick={() => void save()}>Salvar proposta</Button>}
            {dirty && <Button variant="ghost" disabled={busy} onClick={() => void discard(p.aluno_id, p.proposta_id)}>Descartar edições</Button>}
            {p.estado === 'aplicada'
              ? <><Button onClick={() => void openAluno(p.aluno_id)}>Ver programa</Button><Button variant="outline" disabled={busy || resumo.somente_leitura || (sessionRequired && !confirmSession)} onClick={() => void restore()}><RotateCcw size={14} /> Restaurar programa anterior</Button></>
              : <><Button variant="energy" disabled={busy || dirty || p.estado !== 'valida' || !resumo.aplicacao_disponivel || (sessionRequired && !confirmSession)} onClick={() => void apply()}><Check size={15} /> Aplicar programa</Button>
                <Button variant="outline" disabled={busy} onClick={() => void ask(`Ajuste a proposta ${p.proposta_id}, revisão ${p.revisao}, do aluno ${resumo.nome} (aluno_id=${p.aluno_id}). Leia obter_proposta_programa e o guia antes de alterar; salve uma nova revisão para eu conferir.`)}><Sparkles size={14} /> Pedir ajuste</Button></>}
          </footer>
        </section>}
      </>}
    </div>
  </main>
}

/** Card na conversa: o essencial para decidir se vale abrir, sem rolagem. */
function ResumoCard({ resumo, details, carteira, busy, onOpen, onAluno }: { resumo: Resumo; details: Detalhes; carteira: Carteira | null; busy: boolean; onOpen: () => void; onAluno: (id: string) => void }) {
  const p = details.proposta
  if (resumo.tela === 'proposta' && p) return <div className="space-y-3">
    <div className="flex items-center gap-3"><Avatar name={resumo.nome || '?'} /><div className="min-w-0"><h1 className="font-display text-base font-semibold truncate">{resumo.nome}</h1><p className="text-xs text-text-muted">{estadoLabel(p.estado)}</p></div></div>
    <p className="text-text-secondary">{p.resumo_da_mudanca}</p>
    <div className="flex flex-wrap gap-2"><StatChip tone="accent">{p.diferencas.length} alterações para revisar</StatChip>{!!p.validacao.erros.length && <StatChip tone="warning">{p.validacao.erros.length} erros</StatChip>}</div>
    <Button className="w-full" onClick={onOpen}>Revisar proposta <ChevronRight size={16} /></Button>
  </div>
  if (resumo.tela === 'aluno') {
    const c = details.contexto_aluno
    const dores = c?.dores_e_duvidas.filter(x => x.tipo === 'DOR').length ?? 0
    return <div className="space-y-3">
      <div className="flex items-center gap-3"><Avatar name={resumo.nome || '?'} /><div className="min-w-0"><h1 className="font-display text-base font-semibold truncate">{resumo.nome}</h1><p className="text-xs text-text-muted truncate">{c?.perfil.objetivos.join(', ') || 'Objetivo não informado'}</p></div></div>
      <div className="flex flex-wrap gap-2">
        <StatChip tone="accent">{details.programa?.treinos.length ?? 0} treinos</StatChip>
        {c?.estatisticas_treino && <StatChip>{c.estatisticas_treino.sessoes_semana_atual} sessões nesta semana</StatChip>}
        {!!dores && <StatChip tone="warning"><AlertTriangle size={12} /> {dores} dor{dores > 1 ? 'es' : ''} relatada{dores > 1 ? 's' : ''}</StatChip>}
      </div>
      <Button className="w-full" onClick={onOpen}>Abrir aluno <ChevronRight size={16} /></Button>
    </div>
  }
  const itens = carteira?.items ?? []
  const atencao = ordenarAlunos(itens.filter(a => a.urgencia < 3 && a.status !== 'INATIVO'), 'urgencia')
  return <div className="space-y-3">
    <div><h1 className="font-display text-base font-semibold">Sua carteira de alunos</h1>
      <p className="text-xs text-text-muted">{itens.length ? `${itens.length} aluno${itens.length > 1 ? 's' : ''} carregado${itens.length > 1 ? 's' : ''} · ${atencao.length ? `${atencao.length} precisa${atencao.length > 1 ? 'm' : ''} de atenção` : 'nenhuma pendência'}` : 'Consulte alunos, treinos e evolução.'}</p></div>
    {!!atencao.length && <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">{atencao.slice(0, 3).map(a => <li key={a.aluno_id}>
      <AlunoLinha aluno={a} busy={busy} onClick={() => onAluno(a.aluno_id)} compact />
    </li>)}</ul>}
    <Button className="w-full" onClick={onOpen}>Abrir carteira <ChevronRight size={16} /></Button>
  </div>
}

function AlunoLinha({ aluno: a, busy, onClick, compact }: { aluno: Aluno; busy: boolean; onClick: () => void; compact?: boolean }) {
  const st = statusAluno(a)
  return <button type="button" disabled={busy} onClick={onClick} aria-label={`Abrir aluno ${a.nome}`}
    className={`w-full flex items-center gap-3 text-left transition-colors disabled:opacity-60 ${compact ? 'px-3 py-2.5 bg-surface hover:bg-surface-elevated' : ''}`}>
    <Avatar name={a.nome} size={compact ? 'sm' : 'md'} />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5 flex-wrap"><span className="font-medium truncate">{a.nome}</span><Badge tone={st.tone}>{st.label}</Badge></span>
      {!compact && <span className="block text-xs text-text-muted truncate">{a.objetivos?.join(', ') || 'Objetivo não informado'}</span>}
      <span className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5"><Clock size={10} className="shrink-0" />{a.ultimo_treino_em ? `Treinou ${tempoRelativo(a.ultimo_treino_em)}` : 'Ainda não treinou'}</span>
    </span>
    <ChevronRight size={18} className="text-text-muted shrink-0" />
  </button>
}

function CarteiraView({ carteira, busy, busca, setBusca, filtro, setFiltro, ordem, setOrdem, onAluno, onMore }: {
  carteira: Carteira | null; busy: boolean; busca: string; setBusca: (v: string) => void; filtro: string; setFiltro: (v: string) => void
  ordem: string; setOrdem: (v: string) => void; onAluno: (id: string) => void; onMore: () => void
}) {
  const itens = carteira?.items ?? []
  const conta = (f: string) => itens.filter(a => a.filtros.includes(f)).length
  return <section className="space-y-4">
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div><h2 className="font-display text-xl font-semibold">Alunos</h2>
        <p className="text-xs text-text-muted">{itens.length} carregado{itens.length === 1 ? '' : 's'}{carteira && !carteira.cobertura.completa ? ' · há mais páginas' : ''}</p></div>
      <div className="w-36"><Select aria-label="Ordenar" value={ordem} onChange={e => setOrdem(e.target.value)} className="py-1.5 text-xs">
        <option value="urgencia">Mais urgentes</option><option value="nome">Nome (A–Z)</option>
      </Select></div>
    </div>
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
      <Input aria-label="Buscar aluno" placeholder="Buscar por nome…" value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
    </div>
    <div role="radiogroup" aria-label="Mostrar" className="flex gap-1 flex-wrap">
      {FILTROS.map(([v, l]) => <Button key={v} role="radio" aria-checked={filtro === v} size="sm" variant={filtro === v ? 'primary' : 'outline'} onClick={() => setFiltro(v)}>
        {l}{v && !filtro && conta(v) ? <span className="opacity-70">({conta(v)})</span> : null}
      </Button>)}
    </div>
    {!carteira ? <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      : itens.length ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{ordenarAlunos(itens, ordem).map(a => <Card key={a.aluno_id} variant="elevated" className="hover:border-accent/50 transition-colors">
          <AlunoLinha aluno={a} busy={busy} onClick={() => onAluno(a.aluno_id)} />
        </Card>)}</div>
      : <EmptyState icon={<Users />} title={carteira.next_cursor ? 'Nenhum resultado nas páginas examinadas.' : 'Nenhum aluno encontrado para estes filtros.'}
          description={carteira.next_cursor ? 'Continue a busca para examinar o restante da carteira.' : busca || filtro ? 'Tente outro nome ou limpe o filtro.' : undefined}
          action={(busca || filtro) && !carteira.next_cursor ? <Button variant="outline" size="sm" onClick={() => { setBusca(''); setFiltro('') }}>Limpar busca</Button> : undefined} />}
    {carteira?.next_cursor && <div className="flex justify-center"><Button variant="outline" size="sm" disabled={busy} onClick={onMore}>{itens.length ? 'Carregar mais alunos' : 'Continuar busca'}</Button></div>}
    <p className="text-[11px] text-text-muted">“Vencendo”: até {carteira?.criterios.proximos_dias ?? 7} dias. “Sem treinar”: {carteira?.criterios.sem_treinar_dias ?? 10} dias ou mais.</p>
  </section>
}
