import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Dumbbell, Maximize2, Search } from 'lucide-react'
import { ToolError, type Host } from './host'
import { CoachPilot, unpack } from './useCases'
import { estadoLabel, formatValue, labels, ordenarAlunos } from './presentation'
import type { Carteira, Contexto, Detalhes, Evolucao, Operacao, Programa, Proposta, Resumo, ToolResult } from './types'

export function Workspace({ host }: { host: Host }) {
  const api = useMemo(() => new CoachPilot(host), [host])
  const [ready, setReady] = useState(false)
  const [theme, setTheme] = useState('light')
  const [mode, setMode] = useState('inline')
  const [expanded, setExpanded] = useState(false)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [details, setDetails] = useState<Detalhes>({})
  const [privateData, setPrivateData] = useState<unknown>()
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
  const [onlyChanges, setOnlyChanges] = useState(true)

  function receive(result: ToolResult) {
    if (result.isError) { setError(result.content?.map(x => x.text).join('\n') || 'Não foi possível carregar.'); return }
    const data = unpack(result)
    if (!data.resumo?.tela) return
    if (dirtyRef.current) { setPending(result); setNotice('Há uma atualização disponível. Salve ou descarte suas edições antes de abrir.'); return }
    selectionVersion.current += 1
    setPrivateData(undefined)
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
    void host.connect(r => { if (active) receive(r) }, (t, m) => { if (active) { setTheme(t); setMode(m) } })
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
  async function openAluno(id: string) {
    await run(async () => { const data = await api.aluno(id); receive({ structuredContent: data.resumo as unknown as Record<string, unknown>, _meta: { coachpilot: data.detalhes } }); setExpanded(true) })
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
      dirtyRef.current = false; setDirty(false); setNotice('Salvo')
      receive({ structuredContent: data.resumo as unknown as Record<string, unknown>, _meta: { coachpilot: data.detalhes } })
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
        setNotice('Programa aplicado'); setSessionRequired(false)
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
        setNotice('Programa anterior restaurado'); setOperation(r.structuredContent as unknown as Operacao)
        setDetails({ ...details, proposta: { ...p, estado: 'descartada' } })
      } catch (err) {
        if (err instanceof ToolError && /SESSAO_EM_ANDAMENTO/.test(err.message)) setSessionRequired(true)
        throw err
      }
    })
  }

  const isCard = mode === 'inline' && !expanded
  const p = details.proposta
  const canEdit = resumo?.propostas_disponiveis && p && ['valida', 'invalida', 'rascunho'].includes(p.estado)
  return <main className="cp" data-theme={theme} aria-busy={busy}>
    <header className="cp-header"><span className="cp-brand"><Dumbbell size={20} aria-hidden="true" /> CoachPilot</span>
      <span className="cp-muted" role="status">{ready ? (resumo?.somente_leitura ? 'Somente leitura' : 'Conectado') : 'Conectando'}</span>
      {!isCard && <button className="cp-icon" aria-label="Abrir tela cheia" onClick={() => void host.expand().catch(err => setError(err.message))}><Maximize2 size={18} /></button>}
    </header>
    {error && <div className="cp-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Fechar mensagem">×</button></div>}
    <div role="status" className="cp-status">{busy ? (dirty ? 'Salvando…' : 'Carregando…') : notice}</div>
    {pending && !dirty && <button onClick={() => { const r = pending; setPending(null); receive(r) }}>Abrir atualização disponível</button>}
    {!resumo && <p>{ready ? 'Carregando sua carteira…' : 'Aguardando a conexão autenticada.'}</p>}
    {resumo && isCard && <section className="cp-card">
      <h1>{resumo.nome || 'Sua carteira de alunos'}</h1>
      <p>{p ? estadoLabel(p.estado) : details.contexto_aluno?.perfil.objetivos.join(', ') || (resumo.propostas_disponiveis ? 'Consulte alunos, acompanhe a evolução e revise programas.' : 'Consulte alunos, programas e evolução.')}</p>
      {p && <p>{p.resumo_da_mudanca}<br />{p.diferencas.length} alterações para revisar.</p>}
      <button className="cp-primary" onClick={() => setExpanded(true)}>{p ? 'Revisar proposta' : resumo.tela === 'aluno' ? 'Abrir aluno' : 'Abrir carteira'} <ChevronRight size={18} /></button>
    </section>}
    {resumo && !isCard && <>
      {resumo.tela !== 'carteira' && <div className="cp-sticky"><button className="cp-back" onClick={() => void run(back)} disabled={busy}><ArrowLeft size={16} />{resumo.tela === 'proposta' ? 'Aluno' : 'Carteira'}</button>
        <h1>{resumo.nome || 'Aluno'}</h1><p className="cp-muted">{p ? estadoLabel(p.estado) : details.contexto_aluno?.perfil.objetivos.join(', ') || 'Objetivo não informado'}</p>
      </div>}
      {resumo.tela === 'carteira' && <section>
        <h1>Seus alunos</h1><p className="cp-muted">Priorize os programas que precisam de atenção.</p>
        <label className="cp-search"><Search size={18} aria-hidden="true" /><span className="cp-sr">Buscar aluno</span><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome" /></label>
        <div className="cp-controls"><label>Mostrar<select aria-label="Mostrar" value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="">Todos</option><option value="SEM_TREINO_VIGENTE">Sem treino vigente</option><option value="VENCIDOS">Vencidos</option><option value="PROXIMOS">Próximos do vencimento</option><option value="SEM_TREINAR">Sem treinar</option>
        </select></label><label>Ordenar<select aria-label="Ordenar" value={ordem} onChange={e => { setOrdem(e.target.value); host.savePreferences?.({ ordem: e.target.value }) }}><option value="urgencia">Urgência</option><option value="nome">Nome</option></select></label></div>
        <p className="cp-muted">Próximos: até 7 dias. Sem treinar: 10 dias ou mais. Urgência considera vigência, vencimento e atividade entre os alunos carregados.</p>
        {carteira && <>
          <div className="cp-stats"><span><strong>{carteira.items.filter(x => x.status !== 'INATIVO').length}</strong> ativos carregados</span><span><strong>{carteira.items.filter(x => x.filtros.includes('SEM_TREINO_VIGENTE')).length}</strong> sem treino vigente</span><span><strong>{carteira.items.filter(x => x.filtros.includes('SEM_TREINAR')).length}</strong> sem atividade recente</span></div>
          <ul className="cp-students">{ordenarAlunos(carteira.items, ordem).map(a => <li key={a.aluno_id}><div><h2>{a.nome}</h2><p>{a.objetivos?.join(', ') || 'Objetivo não informado'}</p><p className="cp-muted">Último treino: {a.ultimo_treino_em?.slice(0, 10) || 'Não informado'}</p>
            <span className="cp-badge">{a.pendencias[0]?.titulo || (a.filtros.includes('PROXIMOS') ? 'Programa vencendo' : a.vigencia_informada ? 'Sem pendência informada' : 'Vigência não informada')}</span></div>
            <button disabled={busy} onClick={() => void openAluno(a.aluno_id)} aria-label={`Abrir aluno ${a.nome}`}>Abrir aluno <ChevronRight size={16} /></button></li>)}</ul>
          {!carteira.items.length && <p>{carteira.next_cursor ? 'Nenhum resultado nas páginas examinadas. Continue a busca.' : 'Nenhum aluno encontrado para estes filtros.'}</p>}
          {carteira.next_cursor && <button disabled={busy} onClick={() => void run(async () => {
            const r = await host.call(resumo?.carteira_tool || 'listar_alunos', { busca, filtro: filtro || null, limit: 50, cursor: carteira.next_cursor })
            const next = r.structuredContent as unknown as Carteira
            setCarteira({ ...next, items: [...carteira.items, ...next.items].filter((a, i, arr) => arr.findIndex(b => b.aluno_id === a.aluno_id) === i) })
          })}>Continuar busca / carregar mais</button>}
          {!carteira.cobertura.completa && <p className="cp-muted">Busca parcial. Há páginas ainda não examinadas.</p>}
        </>}
      </section>}
      {resumo.tela === 'aluno' && details.programa && <>
        <nav aria-label="Ficha do aluno" className="cp-tabs">{[['geral', 'Visão geral'], ['treinos', 'Treinos'], ['evolucao', 'Evolução']].map(([id, text]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{text}</button>)}</nav>
        {tab === 'geral' && <>
          <p className="cp-muted">Dados consultados em {details.contexto_aluno?.gerado_em || 'data não informada'}.{resumo.revisao != null && ` Revisão ${resumo.revisao}.`}</p>
          {details.contexto_aluno && <><div className="cp-stats"><span><strong>{details.contexto_aluno.estatisticas_treino?.sessoes_semana_atual ?? '—'}</strong> sessões nesta semana</span><span><strong>{details.contexto_aluno.estatisticas_treino?.media_sessoes_por_semana ?? '—'}</strong> média por semana</span></div><Restricoes contexto={details.contexto_aluno} /></>}
          {details.sessao_em_andamento && <p className="cp-warning">Aluno treinando agora: {details.sessao_em_andamento.treino_nome}.</p>}
          {resumo.propostas_disponiveis && <button className="cp-primary" disabled={busy} onClick={() => void ask(`Leia o guia de prescrição, o contexto atualizado e o programa do aluno ${resumo.nome} (aluno_id=${resumo.aluno_id}). ${details.programa!.treinos.length ? 'Prepare uma proposta de revisão do programa' : 'Monte o primeiro programa e pergunte apenas os dados essenciais ausentes'}. Salve uma proposta para minha revisão, preservando os treinos não solicitados.`)}>{details.programa.treinos.length ? 'Pedir revisão do programa' : 'Montar primeiro programa'}</button>}
          <details><summary>Dados privados e anamnese completa</summary><p>Carregar apenas quando precisar revisar os dados completos do aluno.</p><button onClick={() => void run(async () => { const version = selectionVersion.current; const r = await host.call('detalhar_aluno', { aluno_id: resumo.aluno_id }); if (version === selectionVersion.current) setPrivateData(r.structuredContent) })}>Carregar dados privados</button><PrivateDetails data={privateData} /></details>
        </>}
        {tab === 'treinos' && <><ProgramaView programa={details.programa} />{resumo.propostas_disponiveis && <button onClick={() => void ask(`Prepare uma alteração para o programa do aluno ${resumo.nome} (aluno_id=${resumo.aluno_id}), consulte o guia e os dados atuais e salve uma proposta para eu revisar.`)}>Preparar alteração</button>}</>}
        {tab === 'evolucao' && <Evolution host={host} alunoId={resumo.aluno_id!} programa={details.programa} onAsk={ask} />}
      </>}
      {resumo.tela === 'proposta' && p && <section>
        <p>{p.resumo_da_mudanca}</p><p className="cp-muted">Revisão da proposta {p.revisao} · Base do programa {p.revisao_base} · Atualizada em {p.updated_at}</p>
        <ProposalRestrictions host={host} alunoId={p.aluno_id} />
        <label className="cp-check"><input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} />Somente alterações</label>
        {onlyChanges ? <div className="cp-diff">{p.diferencas.length ? p.diferencas.map((d, i) => <article key={`${d.caminho}-${i}`}><h2>{d.nome} <span className="cp-badge">{d.tipo}</span></h2><p>{labels[d.campo || ''] || (d.caminho.includes('exercicios') ? 'Exercício' : 'Treino')}</p><div className="cp-compare"><div><h3>Atual</h3><p>{formatValue(d.atual)}</p></div><div><h3>Proposto</h3><p>{formatValue(d.proposto)}</p></div></div></article>) : <p>Nenhuma alteração na prescrição.</p>}</div>
          : <div className="cp-compare"><div><h2>Atual</h2><ProgramaView programa={p.programa_base} /></div><div><h2>Proposto</h2><ProgramaView programa={p.programa} /></div></div>}
        <Report title="Erros que impedem a aplicação" items={p.validacao.erros} /><Report title="Avisos para revisão" items={p.validacao.avisos} />
        {canEdit && <details><summary>Editar proposta</summary><ProgramEditor programa={p.programa} disabled={busy} errors={p.validacao.erros} onChange={edit} /></details>}
        {sessionRequired && <div className="cp-warning"><p>O aluno está em sessão. Ele poderá terminar, mas a execução não será contabilizada no programa substituído.</p><label className="cp-check"><input type="checkbox" checked={confirmSession} onChange={e => setConfirmSession(e.target.checked)} />Aplicar mesmo com sessão em andamento</label></div>}
        {operation && <div className="cp-success" role="status"><Check size={18} />{p.estado === 'descartada' ? 'Programa restaurado' : 'Programa aplicado'} em {operation.aplicado_em}. Revisão {operation.revisao_resultante}.<br />Operação: {operation.operation_id}</div>}
        <footer className="cp-actions">
          {['desatualizada', 'expirada'].includes(p.estado) && <button disabled={busy} onClick={() => void openAluno(p.aluno_id)}>Ver programa atual</button>}
          {canEdit && <button disabled={busy || !dirty} onClick={() => void save()}>Salvar proposta</button>}
          {dirty && <button disabled={busy} onClick={() => void run(async () => { const r = await api.proposta(p.aluno_id, p.proposta_id); dirtyRef.current = false; setDirty(false); setNotice('Edições descartadas'); receive({ structuredContent: r.resumo as unknown as Record<string, unknown>, _meta: { coachpilot: r.detalhes } }) })}>Descartar edições</button>}
          {p.estado === 'aplicada' ? <><button className="cp-primary" onClick={() => void openAluno(p.aluno_id)}>Ver programa</button><button disabled={busy || resumo.somente_leitura || (sessionRequired && !confirmSession)} onClick={() => void restore()}>Restaurar programa anterior</button></>
            : <><button className="cp-primary" disabled={busy || dirty || p.estado !== 'valida' || !resumo.aplicacao_disponivel || (sessionRequired && !confirmSession)} onClick={() => void apply()}>Aplicar programa</button><button disabled={busy} onClick={() => void ask(`Ajuste a proposta ${p.proposta_id}, revisão ${p.revisao}, do aluno ${resumo.nome} (aluno_id=${p.aluno_id}). Leia obter_proposta_programa e o guia antes de alterar; salve uma nova revisão para eu conferir.`)}>Pedir ajuste</button></>}
        </footer>
      </section>}
    </>}
  </main>

}

function PrivateDetails({ data }: { data?: unknown }) { return data ? <p>{formatValue(data)}</p> : null }

function Restricoes({ contexto }: { contexto: Contexto }) {
  return <section className="cp-restrictions"><h2>Saúde e restrições informadas</h2>
    {contexto.secoes_indisponiveis.includes('anamnese') ? <p className="cp-warning">Não foi possível carregar a anamnese. Confira antes de prescrever.</p>
      : contexto.anamnese ? <><p className="cp-muted">Anamnese de {contexto.anamnese.preenchido_em || 'data não informada'}</p><dl>{contexto.anamnese.respostas.map((r, i) => <div key={i}><dt>{r.pergunta}</dt><dd>{r.resposta}</dd></div>)}</dl></> : <p>Anamnese: não informado.</p>}
    {contexto.secoes_indisponiveis.includes('dores_duvidas') ? <p className="cp-warning">Não foi possível carregar dores e dúvidas.</p>
      : contexto.dores_e_duvidas.filter(x => x.tipo === 'DOR').map((r, i) => <p key={i}><strong>Dor relatada {r.data || ''} {r.exercicio || ''}:</strong> {r.descricao}</p>)}
    {!!contexto.secoes_indisponiveis.length && <p className="cp-muted">Seções indisponíveis: {contexto.secoes_indisponiveis.join(', ')}.</p>}
  </section>
}

function ProposalRestrictions({ host, alunoId }: { host: Host; alunoId: string }) {
  const [contexto, setContexto] = useState<Contexto>()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void host.call('mostrar_aluno', { aluno_id: alunoId }).then(r => { if (active) setContexto(unpack(r).detalhes.contexto_aluno) })
      .catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [host, alunoId])
  return contexto ? <Restricoes contexto={contexto} /> : <p className={error ? 'cp-warning' : 'cp-muted'}>{error ? 'Não foi possível carregar as restrições. Confira os dados do aluno.' : 'Carregando restrições informadas…'}</p>
}

export function ProgramaView({ programa }: { programa: Programa }) {
  if (!programa.treinos.length) return <p>Sem programa atual.</p>
  return <div className="cp-program">{programa.treinos.map((t, i) => <details key={t.origem_id || i} open><summary>{t.nome}</summary>
    <p>{t.foco || 'Foco não informado'} · {t.ativo ? 'Ativo' : 'Inativo'}</p><p className="cp-muted">Vigência: {t.data_inicio || 'sem início informado'} a {t.data_fim || 'sem fim informado'}</p>
    {t.observacoes && <p>{t.observacoes}</p>}
    {t.blocos.map((b, n) => <div className="cp-block" key={n}><h3>Bloco {String(b.nome || b.formato || n + 1)}</h3><p>{formatValue(b)}</p></div>)}
    {t.exercicios.map((e, n) => <article className="cp-exercise" key={e.origem_id || n}>
      <h3>{e.nome}{e.aquecimento ? ' · Aquecimento' : ''}</h3><p className="cp-muted">{e.tipo_exercicio} · {e.grupos?.join(', ') || e.grupo || 'Grupo não informado'}{e.bloco_id ? ` · Bloco ${e.bloco_id}` : ''}</p>
      <p>{e.series_prescritas?.map(s => `${s.series} × ${s.reps} ${e.unidade_reps || (e.tipo_exercicio === 'FORCA' ? 'reps' : '')}${s.carga ? ` · ${s.carga} ${e.unidade_carga || 'kg'}` : ''}${s.aquecimento ? ' (aproximação)' : ''}`).join(' / ') || 'Prescrição por bloco / não informada'}</p>
      <p>Intervalo: {e.intervalo_s == null ? 'Não informado' : `${e.intervalo_s} s`}</p>{e.observacoes && <p>{e.observacoes}</p>}
      {e.video_url && /^https?:\/\//.test(e.video_url) && <a href={e.video_url} target="_blank" rel="noreferrer">Vídeo de {e.nome}</a>}
      {!!e.substitutos.length && <details><summary>Substitutos</summary>{e.substitutos.map((s, si) => <p key={si}>{s.nome}{s.observacao ? `: ${s.observacao}` : ''}{s.series_prescritas ? ` · ${formatValue(s.series_prescritas)}` : ''}{s.video_url && /^https?:\/\//.test(s.video_url) && <> · <a href={s.video_url} target="_blank" rel="noreferrer">Vídeo</a></>}</p>)}</details>}
    </article>)}
  </details>)}</div>
}

function Report({ title, items }: { title: string; items: Proposta['validacao']['erros'] }) {
  if (!items.length) return null
  return <section className="cp-report"><h2>{title}</h2><ul>{items.map((e, i) => <li key={i}>{e.onde && <strong>{e.onde}: </strong>}{e.mensagem}{e.correcao && <p>{e.correcao}</p>}</li>)}</ul></section>
}

function ProgramEditor({ programa, onChange, disabled, errors }: { programa: Programa; onChange: (p: Programa) => void; disabled: boolean; errors: Proposta['validacao']['erros'] }) {
  function change(fn: (p: Programa) => void) { const copy = structuredClone(programa); fn(copy); onChange(copy) }
  function field(path: string, label: string, value: string | number | null | undefined, update: (value: string) => void, type = 'text') {
    const error = errors.find(x => (x.campo || x.caminho) === path)
    const id = `cp-${path}`
    return <label key={path} htmlFor={id}>{label}<input id={id} type={type} value={value ?? ''} disabled={disabled} min={type === 'number' ? 0 : undefined} onChange={e => update(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />{error && <span id={`${id}-error`} className="cp-error">{error.mensagem}</span>}</label>
  }
  return <div className="cp-editor">{programa.treinos.map((t, ti) => <fieldset key={ti}><legend>{t.nome}</legend><div className="cp-fields">
    {field(`treinos[${ti}].data_inicio`, 'Início da vigência', t.data_inicio, v => change(p => { p.treinos[ti].data_inicio = v || null }), 'date')}
    {field(`treinos[${ti}].data_fim`, 'Fim da vigência', t.data_fim, v => change(p => { p.treinos[ti].data_fim = v || null }), 'date')}
    {field(`treinos[${ti}].observacoes`, 'Observações do treino', t.observacoes, v => change(p => { p.treinos[ti].observacoes = v || null }))}
  </div>{t.exercicios.map((e, ei) => <fieldset key={ei}><legend>{e.nome}</legend>
    {t.blocos.length || e.bloco_id ? <p>Para alterar a prescrição deste bloco, use “Pedir ajuste”.</p> : <div className="cp-fields">{e.series_prescritas?.map((s, si) => <div className="cp-series" key={si}>
      {field(`treinos[${ti}].exercicios[${ei}].series_prescritas[${si}].series`, `Séries (grupo ${si + 1})`, s.series, v => change(p => { p.treinos[ti].exercicios[ei].series_prescritas![si].series = Number(v) }), 'number')}
      {field(`treinos[${ti}].exercicios[${ei}].series_prescritas[${si}].reps`, `${e.tipo_exercicio === 'PERFORMANCE' ? 'Métrica' : 'Repetições'} ${e.unidade_reps || ''}`, s.reps, v => change(p => { p.treinos[ti].exercicios[ei].series_prescritas![si].reps = v }))}
      {field(`treinos[${ti}].exercicios[${ei}].series_prescritas[${si}].carga`, `Carga ${e.unidade_carga || ''}`, s.carga, v => change(p => { p.treinos[ti].exercicios[ei].series_prescritas![si].carga = v || null }))}
    </div>)}</div>}
    <div className="cp-fields">{field(`treinos[${ti}].exercicios[${ei}].intervalo_s`, 'Intervalo (segundos)', e.intervalo_s, v => change(p => { p.treinos[ti].exercicios[ei].intervalo_s = v === '' ? null : Number(v) }), 'number')}
      {field(`treinos[${ti}].exercicios[${ei}].observacoes`, 'Observações do exercício', e.observacoes, v => change(p => { p.treinos[ti].exercicios[ei].observacoes = v || null }))}</div>
  </fieldset>)}</fieldset>)}</div>
}

function Evolution({ host, alunoId, programa, onAsk }: { host: Host; alunoId: string; programa: Programa; onAsk: (text: string) => Promise<void> }) {
  const exercicios = programa.treinos.flatMap(t => t.exercicios).filter((e, i, arr) => arr.findIndex(x => x.nome === e.nome) === i)
  const [nome, setNome] = useState(exercicios[0]?.nome || '')
  const [dias, setDias] = useState('90')
  const [metric, setMetric] = useState('carga_max')
  const [selectedUnit, setSelectedUnit] = useState('')
  const [data, setData] = useState<Evolucao>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ex = exercicios.find(e => e.nome === nome)
  useEffect(() => {
    if (!nome) return
    let active = true
    setLoading(true); setError('')
    void host.call('evolucao_exercicio', { aluno_id: alunoId, ...(ex?.origem_id ? { exercicio_id: ex.origem_id } : { chave: ex?.chave_historico || nome }), limit: 200 }).then(r => {
      if (active) { setData(r.structuredContent as unknown as Evolucao); setSelectedUnit(''); setMetric(ex?.tipo_exercicio === 'PERFORMANCE' ? 'metrica_max' : 'carga_max') }
    }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [host, alunoId, nome])
  const units = [...new Set((data?.serie || []).map(p => (metric === 'metrica_max' ? p.unidade_reps : p.unidade_carga) || 'unidade não informada'))]
  const unit = units.includes(selectedUnit) ? selectedUnit : units[0] || 'unidade não informada'
  const cutoff = new Date(Date.now() - Number(dias) * 86400000).toISOString()
  const points = (data?.serie || []).filter(p => (!dias || p.data >= cutoff) && ((metric === 'metrica_max' ? p.unidade_reps : p.unidade_carga) || 'unidade não informada') === unit).map(p => ({ data: p.data, valor: p[metric as 'carga_max'] })).filter(p => p.valor != null && Number.isFinite(p.valor)) as { data: string; valor: number }[]
  return <section><h2>Evolução por exercício</h2>{!exercicios.length ? <p>Nenhum exercício no programa atual.</p> : <>
    <div className="cp-controls"><label>Exercício<select aria-label="Exercício" value={nome} onChange={e => setNome(e.target.value)}>{exercicios.map(e => <option key={e.nome}>{e.nome}</option>)}</select></label><label>Período<select aria-label="Período" value={dias} onChange={e => setDias(e.target.value)}><option value="30">30 dias</option><option value="90">90 dias</option><option value="">Todo histórico disponível</option></select></label>
      <label>Métrica<select aria-label="Métrica" value={metric} onChange={e => { setMetric(e.target.value); setSelectedUnit('') }}>{ex?.tipo_exercicio === 'PERFORMANCE' ? <option value="metrica_max">Melhor métrica da sessão</option> : <><option value="carga_max">Carga máxima</option><option value="volume">Volume</option></>}</select></label>
      <label>Unidade<select aria-label="Unidade" value={unit} onChange={e => setSelectedUnit(e.target.value)}>{units.map(u => <option key={u}>{u}</option>)}</select></label>
    </div>{loading && <p role="status">Carregando evolução…</p>}{error && <p className="cp-error" role="alert">{error}</p>}
    {!loading && !error && <><p>{points.length} registros com {metric === 'volume' ? 'volume' : 'valor'} informado ({unit}). Cobertura: até os últimos 200 registros. Valores ausentes não são estimados.</p>{unit === 'unidade não informada' ? <p>Estes registros antigos não informam a unidade. Confira os valores na tabela; o gráfico exige uma unidade registrada.</p> : <EvolutionChart points={points} unit={unit} />}<table><caption>Registros de {nome} — {unit}</caption><thead><tr><th scope="col">Data</th><th scope="col">Valor ({unit})</th></tr></thead><tbody>{points.map((p, i) => <tr key={i}><td>{p.data.slice(0, 10)}</td><td>{p.valor}</td></tr>)}</tbody></table></>}
    <button onClick={() => void onAsk(`Analise a evolução de ${nome} do aluno_id=${alunoId} no período de ${dias || 'todos os'} dias, usando os dados atuais e a unidade ${unit}. Explique a cobertura e proponha ajustes para minha revisão.`)}>Analisar evolução</button>
  </>}</section>
}

export function EvolutionChart({ points, unit }: { points: { data: string; valor: number }[]; unit: string }) {
  if (!points.length) return <p>Sem registros com esta métrica no período.</p>
  const min = Math.min(...points.map(p => p.valor)); const max = Math.max(...points.map(p => p.valor))
  const coordinates = points.map((p, i) => ({ x: 40 + i * 280 / Math.max(points.length - 1, 1), y: 140 - (p.valor - min) * 105 / Math.max(max - min, 1) }))
  return <figure className="cp-chart"><svg viewBox="0 0 350 180" role="img" aria-label={`Evolução em ${unit}, de ${min} a ${max}. Valores disponíveis na tabela.`}><text x="5" y="25">{max} {unit}</text><text x="5" y="165">{min} {unit}</text><polyline fill="none" stroke="currentColor" strokeWidth="3" points={coordinates.map(p => `${p.x},${p.y}`).join(' ')} />{coordinates.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="currentColor"><title>{points[i].data}: {points[i].valor} {unit}</title></circle>)}</svg></figure>
}
