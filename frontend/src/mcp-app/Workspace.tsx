import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, Clock, ExternalLink, Maximize2, MessageSquare, RotateCcw, Search, Sparkles, Users } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input, Select } from '../components/ui/Input'
import { SkeletonCard } from '../components/ui/Skeleton'
import { Spinner } from '../components/ui/Spinner'
import { Tabs } from '../components/ui/Tabs'
import type { Capacidades, Host } from './host'
import { CoachPilot, unpack } from './useCases'
import { ordenarAlunos } from './presentation'
import { Alert, BotaoPedido, Brand, fmtDateTime, statusAluno, tempoRelativo } from './ui'
import { AtencaoSaude, ContextoPrescricao, DadosPrivados, Restricoes } from './Aluno'
import { ProgramaView, type AcoesPrograma } from './Programa'
import { Evolucao } from './Evolucao'
import type { Aluno, Carteira, Detalhes, Resumo, ToolResult } from './types'

const FILTROS = [['', 'Todos'], ['SEM_TREINO_VIGENTE', 'Sem treino vigente'], ['VENCIDOS', 'Vencidos'], ['PROXIMOS', 'Vencendo'], ['SEM_TREINAR', 'Sem treinar']] as const
/** Filtros cuja fila faz sentido tratar com o chat, um aluno por vez. */
const FILAS: Record<string, string> = { SEM_TREINO_VIGENTE: 'sem treino vigente', VENCIDOS: 'com treino vencido', PROXIMOS: 'com treino vencendo' }
/** Host sem `capabilities()` (testes, versões antigas): presume o comportamento anterior. */
const CAPS_PADRAO: Capacidades = { fullscreen: true, contexto: true, mensagem: true }
const CONFIRMAR = 'Só grave depois que eu confirmar.'

/** A tela só lê; toda ação é um pedido à conversa, e quem grava é o ChatGPT com as tools
 *  publicadas. Sempre com nome e `aluno_id` explícitos — não depende de o host ter recebido
 *  a seleção — e sempre pedindo confirmação antes de gravar. */
export const pedidos = {
  revisar: (nome: string, id: string, temTreino: boolean) => temTreino
    ? `Quero revisar o treino de ${nome} (aluno_id=${id}). Leia guia_de_prescricao, detalhar_aluno e exportar_programa_treino, me diga o que considerar e proponha os ajustes aqui na conversa, mostrando o antes e o depois. ${CONFIRMAR} Para gravar, use aplicar_programa_treino com o programa completo.`
    : `Quero montar o primeiro treino de ${nome} (aluno_id=${id}). Leia guia_de_prescricao e detalhar_aluno, pergunte só o que faltar e proponha o programa aqui na conversa. ${CONFIRMAR} Para gravar, use aplicar_programa_treino.`,
  ajustar: (nome: string, id: string, treino: string) =>
    `Quero ajustar o treino "${treino}" de ${nome} (aluno_id=${id}). Pergunte o que devo mudar. Depois leia guia_de_prescricao e exportar_programa_treino e mostre o antes e o depois. ${CONFIRMAR} Para gravar, use aplicar_programa_treino mantendo os outros treinos iguais.`,
  renovar: (nome: string, id: string, treino: string) =>
    `O treino "${treino}" de ${nome} (aluno_id=${id}) está vencido. Pergunte até quando devo renovar. ${CONFIRMAR} Para gravar a nova data, use atualizar_treino (o treino_id vem de exportar_programa_treino).`,
  trocar: (nome: string, id: string, treino: string, exercicio: string) =>
    `No treino "${treino}" de ${nome} (aluno_id=${id}), quero trocar o exercício "${exercicio}". Sugira 2 ou 3 opções da minha biblioteca (listar_biblioteca_exercicios) respeitando as restrições do aluno (detalhar_aluno). ${CONFIRMAR} Para gravar a opção escolhida, use aplicar_programa_treino mantendo o resto do programa.`,
  desfazer: (nome: string, id: string) =>
    `Quero desfazer a última alteração de treino de ${nome} (aluno_id=${id}) feita pela conversa. Me diga o que será restaurado e só chame desfazer_alteracao_treino depois que eu confirmar.`,
  fila: (fila: string, alunos: Aluno[]) =>
    `Quero atualizar os treinos dos alunos ${fila}: ${alunos.map(a => `${a.nome} (aluno_id=${a.aluno_id})`).join('; ')}. Vamos um por vez: para cada um, leia guia_de_prescricao, detalhar_aluno e exportar_programa_treino, proponha o ajuste e só grave com aplicar_programa_treino depois que eu confirmar.`,
}

export function Workspace({ host }: { host: Host }) {
  const api = useMemo(() => new CoachPilot(host), [host])
  const [ready, setReady] = useState(false)
  const [theme, setTheme] = useState('light')
  const [mode, setMode] = useState('inline')
  const [expanded, setExpanded] = useState(false)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [details, setDetails] = useState<Detalhes>({})
  const [carteira, setCarteira] = useState<Carteira | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  const [ordem, setOrdem] = useState(host.preferences?.().ordem || 'urgencia')
  const [tab, setTab] = useState('geral')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const caps = ready ? host.capabilities?.() ?? CAPS_PADRAO : CAPS_PADRAO

  // Os tokens valem a partir do <html> (fundo, barra de rolagem).
  useEffect(() => { document.documentElement.dataset.theme = theme; document.body.dataset.mode = mode }, [theme, mode])
  // Saiu da tela cheia: volta a ser card, sem deixar a área de trabalho inteira na conversa.
  const prevMode = useRef(mode)
  useEffect(() => {
    if (prevMode.current === 'fullscreen' && mode === 'inline') setExpanded(false)
    prevMode.current = mode
  }, [mode])

  /** Troca a tela atual; `manterAba` preserva a aba quando é o mesmo aluno sendo recarregado. */
  function receive(result: ToolResult, manterAba = false) {
    if (result.isError) { setError(result.content?.map(x => x.text).join('\n') || 'Não foi possível carregar.'); return }
    const data = unpack(result)
    if (!data.resumo?.tela) return
    const mesmoAluno = data.resumo.aluno_id && data.resumo.aluno_id === resumo?.aluno_id && data.resumo.tela === resumo?.tela
    setResumo(data.resumo); setDetails(data.detalhes); setError('')
    if (!(manterAba && mesmoAluno)) setTab('geral')
    if (data.resumo.tela === 'carteira') setCarteira(result._meta?.coachpilot as unknown as Carteira)
    if (data.resumo.aluno_id) host.setOpenInApp?.(`/alunos/${data.resumo.aluno_id}`)
    void host.context({ aluno_id: data.resumo.aluno_id, nome: data.resumo.nome, tela: data.resumo.tela }).catch(() => false)
  }

  // `mostrar_aluno` pode terminar depois de o card ficar pronto. A carteira de fallback não
  // entra se a tool pediu um aluno, nem sobrescreve o resultado que o host entregou.
  const resultadoDoHost = useRef(false)
  const alunoPedido = useRef(false)
  useEffect(() => {
    let active = true
    void host.connect(r => { if (!active) return; resultadoDoHost.current = true; receive(r) },
      (t, m) => { if (!active) return; if (t) setTheme(t); if (m) setMode(m) },
      args => { if (typeof args.aluno_id === 'string' && args.aluno_id) alunoPedido.current = true })
      .then(() => { if (active) setReady(true) }).catch(err => { if (active) setError(String(err.message ?? err)) })
    return () => { active = false; host.dispose() }
  }, [host])

  useEffect(() => {
    if (!ready || resumo || alunoPedido.current) return
    void host.call('abrir_coachpilot', {}).then(r => { if (!resultadoDoHost.current) receive(r) }).catch(err => setError(err.message))
  }, [ready])

  useEffect(() => {
    if (!ready || resumo?.tela !== 'carteira' || (!expanded && mode === 'inline')) return
    let active = true
    const timer = setTimeout(() => {
      setBusy(true)
      void host.call(resumo?.carteira_tool || 'consultar_carteira_visual', { busca, filtro: filtro || null, limit: 50 })
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
  /** Ampliar é escolha do personal. Sem tela cheia, carteira e ficha continuam no card e oferecem o portal. */
  async function ampliar() {
    const ok = await host.expand().catch(() => false)
    if (ok) setExpanded(true)
  }
  /** Navegar não implica ampliar: do card, o aluno abre como card de contexto. */
  async function openAluno(id: string, ampliarTela = !isCard) {
    await run(async () => {
      const data = await api.aluno(id)
      receive({ structuredContent: data.resumo as unknown as Record<string, unknown>, _meta: { coachpilot: data.detalhes } }, true)
      if (ampliarTela) await ampliar()
    })
  }
  async function back() {
    receive(await host.call('abrir_coachpilot', { busca, filtro: filtro || null }))
  }
  /** Pedido à conversa: erro vira mensagem, e a promessa rejeita para o botão não fingir que enviou. */
  async function ask(text: string) {
    setError('')
    try { await host.ask(text) } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível enviar. Peça na conversa.'); throw err }
  }
  async function portal(path: string) {
    await run(async () => { if (!(await host.openPortal?.(path))) throw new Error('Não foi possível abrir o portal daqui. Acesse coachpilot.com.br.') })
  }

  const isCard = mode === 'inline' && !expanded
  const temTreino = !!details.programa?.treinos.length
  const nome = resumo?.nome || 'aluno'
  const alunoId = resumo?.aluno_id || ''
  const acoes: AcoesPrograma | undefined = caps.mensagem && alunoId ? {
    ajustar: t => pedidos.ajustar(nome, alunoId, t.nome),
    renovar: t => pedidos.renovar(nome, alunoId, t.nome),
    trocar: (t, e) => pedidos.trocar(nome, alunoId, t.nome, e.nome),
    pedir: ask,
  } : undefined

  return <main data-theme={theme} aria-busy={busy} className={`font-sans text-text text-sm leading-relaxed ${isCard ? 'p-4 bg-surface' : 'min-h-screen'}`}>
    {!isCard && <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-xl">
      <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-2">
        <Brand>{busy && <Spinner className="w-4 h-4 border-[1.5px] ml-1" />}</Brand>
        {mode !== 'fullscreen' && caps.fullscreen && <Button variant="ghost" size="sm" iconOnly aria-label="Abrir tela cheia" onClick={() => void host.expand().catch(err => setError(err.message))}><Maximize2 size={16} /></Button>}
      </div>
    </header>}

    <div className={isCard ? 'space-y-3' : 'max-w-3xl mx-auto px-4 py-4 space-y-4'}>
      {error && <Alert tone="danger" role="alert" onClose={() => setError('')}>{error}</Alert>}
      <p role="status" className="sr-only">{busy ? 'Carregando…' : ''}</p>

      {!resumo && !error && <div className="space-y-3"><p className="text-text-secondary">{ready ? 'Carregando sua carteira…' : 'Aguardando a conexão autenticada.'}</p><SkeletonCard /></div>}

      {resumo && isCard && <ResumoCard resumo={resumo} details={details} carteira={carteira} busy={busy} caps={caps}
        onOpen={() => void run(ampliar)} onAluno={id => void openAluno(id, false)} onAsk={ask} onPortal={portal} />}

      {resumo && !isCard && <>
        {resumo.tela === 'carteira' && <CarteiraView carteira={carteira} busy={busy} busca={busca} setBusca={setBusca} filtro={filtro} setFiltro={setFiltro}
          ordem={ordem} setOrdem={o => { setOrdem(o); host.savePreferences?.({ ordem: o }) }} onAluno={id => void openAluno(id)}
          onAsk={caps.mensagem ? ask : undefined}
          onMore={() => void run(async () => {
            const r = await host.call(resumo.carteira_tool || 'consultar_carteira_visual', { busca, filtro: filtro || null, limit: 50, cursor: carteira!.next_cursor })
            const next = r.structuredContent as unknown as Carteira
            setCarteira({ ...next, items: [...carteira!.items, ...next.items].filter((a, i, arr) => arr.findIndex(b => b.aluno_id === a.aluno_id) === i) })
          })} />}

        {resumo.tela === 'aluno' && <div>
          <button type="button" onClick={() => void run(back)} disabled={busy} className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text mb-3 disabled:opacity-50">
            <ArrowLeft size={16} />Alunos
          </button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold break-words">{nome}</h2>
              <p className="text-xs text-text-muted">{details.contexto_aluno?.perfil.objetivos.join(', ') || 'Objetivo não informado'}</p>
            </div>
            {caps.mensagem && details.programa && <BotaoPedido texto={pedidos.revisar(nome, alunoId, temTreino)} onPedir={ask}>
              <Sparkles size={15} />{temTreino ? 'Revisar treino' : 'Montar primeiro treino'}
            </BotaoPedido>}
          </div>
          {details.sessao_em_andamento && <div className="mt-3"><Alert tone="warning">Aluno treinando agora{details.sessao_em_andamento.treino_nome ? `: ${details.sessao_em_andamento.treino_nome}` : ''}.</Alert></div>}
        </div>}

        {resumo.tela === 'aluno' && details.programa && <>
          <Tabs tabs={[{ key: 'geral', label: 'Visão geral' }, { key: 'treinos', label: 'Treinos', badge: details.programa.treinos.length }, { key: 'evolucao', label: 'Evolução' }]} active={tab} onChange={setTab} />
          {tab === 'geral' && <div className="space-y-4">
            {details.contexto_aluno && <>
              <Card variant="elevated"><ContextoPrescricao contexto={details.contexto_aluno} programa={details.programa} /></Card>
              <Restricoes contexto={details.contexto_aluno} />
            </>}
            <DadosPrivados key={alunoId} host={host} alunoId={alunoId} />
            <p className="text-[11px] text-text-muted">Dados consultados {details.contexto_aluno?.gerado_em ? `em ${fmtDateTime(details.contexto_aluno.gerado_em)}` : 'agora'}.</p>
          </div>}
          {tab === 'treinos' && <div className="space-y-3">
            <ProgramaView key={alunoId} programa={details.programa} acoes={acoes} />
            {acoes && temTreino && <div className="flex justify-end">
              <BotaoPedido variant="ghost" size="sm" texto={pedidos.desfazer(nome, alunoId)} onPedir={ask}><RotateCcw size={14} /> Desfazer última alteração</BotaoPedido>
            </div>}
            {!caps.mensagem && <p className="text-xs text-text-muted">Para alterar um treino, peça na conversa.</p>}
          </div>}
          {tab === 'evolucao' && <Evolucao key={alunoId} host={host} alunoId={alunoId} programa={details.programa} onAsk={ask} />}
        </>}
      </>}
    </div>
  </main>
}

/** Card na conversa: um escopo, no máximo duas ações, sem rolagem interna. */
function ResumoCard({ resumo, details, carteira, busy, caps, onOpen, onAluno, onAsk, onPortal }: {
  resumo: Resumo; details: Detalhes; carteira: Carteira | null; busy: boolean; caps: Capacidades
  onOpen: () => void; onAluno: (id: string) => void; onAsk: (text: string) => Promise<void>; onPortal: (path: string) => Promise<void>
}) {
  if (resumo.tela === 'aluno') {
    const c = details.contexto_aluno
    const temTreino = !!details.programa?.treinos.length
    return <div className="space-y-3">
      <div className="min-w-0"><h1 className="font-display text-base font-semibold break-words">{resumo.nome}</h1>
        <p className="text-[11px] text-text-muted">Antes de prescrever · dados de {fmtDateTime(c?.gerado_em) ?? 'agora'}</p></div>
      {details.sessao_em_andamento && <Alert tone="warning">Treinando agora{details.sessao_em_andamento.treino_nome ? `: ${details.sessao_em_andamento.treino_nome}` : ''}.</Alert>}
      {c ? <><AtencaoSaude contexto={c} limite={2} /><ContextoPrescricao contexto={c} programa={details.programa} /></>
        : <p className="text-sm text-text-muted">Contexto do aluno indisponível nesta consulta.</p>}
      <div className="flex flex-wrap gap-2">
        {caps.fullscreen ? <Button className="flex-1" disabled={busy} onClick={onOpen}>Ver ficha <ChevronRight size={16} /></Button>
          : <Button className="flex-1" variant="outline" disabled={busy} onClick={() => void onPortal(`/alunos/${resumo.aluno_id}`)}><ExternalLink size={14} /> Abrir no portal</Button>}
        {caps.mensagem && <BotaoPedido className="flex-1" variant="outline" disabled={busy} onPedir={onAsk}
          texto={pedidos.revisar(resumo.nome || 'aluno', resumo.aluno_id!, temTreino)}>
          <MessageSquare size={14} /> {temTreino ? 'Revisar treino' : 'Montar primeiro treino'}
        </BotaoPedido>}
      </div>
    </div>
  }

  const itens = carteira?.items ?? []
  const completa = !!carteira?.cobertura.completa && !carteira.next_cursor
  const atencao = ordenarAlunos(itens.filter(a => a.urgencia < 3 && a.status !== 'INATIVO'), 'urgencia')
  const escopo = completa ? '' : ' entre os carregados'
  return <div className="space-y-3">
    <div><h1 className="font-display text-base font-semibold">Quem precisa de atenção</h1>
      <p className="text-xs text-text-muted">{itens.length
        ? `${itens.length} aluno${itens.length > 1 ? 's' : ''} ${completa ? 'na carteira' : 'carregados'} · ${atencao.length ? `${atencao.length} com pendência${escopo}` : `nenhuma pendência${escopo}`}`
        : 'Consulte alunos, treinos e evolução.'}</p></div>
    {!!atencao.length && <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">{atencao.slice(0, 3).map(a => <li key={a.aluno_id}>
      <AlunoLinha aluno={a} busy={busy} onClick={() => onAluno(a.aluno_id)} compact />
    </li>)}</ul>}
    {atencao.length > 3 && <p className="text-xs text-text-muted">+ {atencao.length - 3} com pendência na carteira.</p>}
    {caps.fullscreen
      ? <Button className="w-full" variant={atencao.length ? 'outline' : 'primary'} onClick={onOpen}>Abrir carteira <ChevronRight size={16} /></Button>
      : <Button className="w-full" variant="outline" onClick={() => void onPortal('/alunos')}><ExternalLink size={14} /> Abrir carteira no portal</Button>}
  </div>
}

function AlunoLinha({ aluno: a, busy, onClick, compact }: { aluno: Aluno; busy: boolean; onClick: () => void; compact?: boolean }) {
  const st = statusAluno(a)
  return <button type="button" disabled={busy} onClick={onClick} aria-label={`Abrir aluno ${a.nome}`}
    className={`w-full flex items-center gap-3 text-left transition-colors disabled:opacity-60 ${compact ? 'px-3 py-2.5 bg-surface hover:bg-surface-elevated' : 'px-4 py-3 hover:bg-surface-elevated'}`}>
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5 flex-wrap"><span className="font-medium break-words">{a.nome}</span><Badge tone={st.tone}>{st.label}</Badge></span>
      {!compact && <span className="block text-xs text-text-muted break-words">{a.objetivos?.join(', ') || 'Objetivo não informado'}</span>}
      <span className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5"><Clock size={10} className="shrink-0" />{a.ultimo_treino_em ? `Treinou ${tempoRelativo(a.ultimo_treino_em)}` : 'Ainda não treinou'}</span>
    </span>
    <ChevronRight size={18} className="text-text-muted shrink-0" />
  </button>
}

function CarteiraView({ carteira, busy, busca, setBusca, filtro, setFiltro, ordem, setOrdem, onAluno, onMore, onAsk }: {
  carteira: Carteira | null; busy: boolean; busca: string; setBusca: (v: string) => void; filtro: string; setFiltro: (v: string) => void
  ordem: string; setOrdem: (v: string) => void; onAluno: (id: string) => void; onMore: () => void; onAsk?: (text: string) => Promise<void>
}) {
  const itens = carteira?.items ?? []
  const parcial = !!carteira && (!carteira.cobertura.completa || !!carteira.next_cursor)
  const conta = (f: string) => itens.filter(a => a.filtros.includes(f)).length
  const fila = FILAS[filtro] && onAsk ? ordenarAlunos(itens.filter(a => a.status !== 'INATIVO'), 'urgencia') : []
  return <section className="space-y-4">
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div><h2 className="font-display text-xl font-semibold">Alunos</h2>
        <p className="text-xs text-text-muted">{itens.length} carregado{itens.length === 1 ? '' : 's'}{parcial ? ' · há mais páginas; contagens valem para os carregados' : ''}</p></div>
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
    {!!fila.length && onAsk && <BotaoPedido variant="outline" size="sm" texto={pedidos.fila(FILAS[filtro], fila)} onPedir={onAsk}>
      <MessageSquare size={14} /> Atualizar {fila.length === 1 ? 'este aluno' : `estes ${fila.length} alunos`} com o chat
    </BotaoPedido>}
    {!carteira ? <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      : itens.length ? <Card variant="elevated" className="!p-0 overflow-hidden"><ul className="divide-y divide-border">{ordenarAlunos(itens, ordem).map(a => <li key={a.aluno_id}>
          <AlunoLinha aluno={a} busy={busy} onClick={() => onAluno(a.aluno_id)} />
        </li>)}</ul></Card>
      : <EmptyState icon={<Users />} title={carteira.next_cursor ? 'Nenhum resultado nas páginas examinadas.' : 'Nenhum aluno encontrado para estes filtros.'}
          description={carteira.next_cursor ? 'Continue a busca para examinar o restante da carteira.' : busca || filtro ? 'Tente outro nome ou limpe o filtro.' : undefined}
          action={(busca || filtro) && !carteira.next_cursor ? <Button variant="outline" size="sm" onClick={() => { setBusca(''); setFiltro('') }}>Limpar busca</Button> : undefined} />}
    {carteira?.next_cursor && <div className="flex justify-center"><Button variant="outline" size="sm" disabled={busy} onClick={onMore}>{itens.length ? 'Carregar mais alunos' : 'Continuar busca'}</Button></div>}
    <p className="text-[11px] text-text-muted">“Vencendo”: até {carteira?.criterios.proximos_dias ?? 7} dias. “Sem treinar”: {carteira?.criterios.sem_treinar_dias ?? 10} dias ou mais.</p>
  </section>
}
