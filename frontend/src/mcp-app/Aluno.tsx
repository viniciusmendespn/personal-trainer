import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, ClipboardList, Lock } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { Host } from './host'
import { frequencia, lerAnamnese, respostaLegivel, respostaNegativa, situacaoPrograma } from './presentation'
import { unpack } from './useCases'
import { Alert, SectionTitle, diaLocal, fmtDate, fmtDateTime, tempoRelativo } from './ui'
import type { Contexto, Programa } from './types'

function Linha({ rotulo, children, alerta }: { rotulo: string; children: ReactNode; alerta?: boolean }) {
  return <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 py-1.5 border-b border-border last:border-b-0">
    <dt className="text-xs text-text-muted pt-0.5">{rotulo}</dt>
    <dd className={`text-sm min-w-0 break-words ${alerta ? 'text-warning font-medium' : 'text-text'}`}>{children}</dd>
  </div>
}

/** O que o personal precisa considerar antes de prescrever — fatos registrados, sem avaliação inventada. */
export function ContextoPrescricao({ contexto: c, programa }: { contexto: Contexto; programa?: Programa }) {
  const { rotina } = lerAnamnese(c)
  const prog = situacaoPrograma(programa, diaLocal(new Date()))
  const freq = frequencia(c)
  const ultimo = c.estatisticas_treino?.ultimo_treino_em
  const conhecidas = rotina.filter(r => r.resposta)
  const faltando = rotina.filter(r => !r.resposta).map(r => r.rotulo.toLowerCase())
  const semAnamnese = c.secoes_indisponiveis.includes('anamnese')
  return <dl>
    <Linha rotulo="Objetivo">{c.perfil.objetivos.length ? c.perfil.objetivos.join(', ') : <span className="text-text-muted">não informado</span>}{c.perfil.idade ? <span className="text-text-muted"> · {c.perfil.idade} anos</span> : null}</Linha>
    {conhecidas.map(r => <Linha key={r.rotulo} rotulo={r.rotulo}>{r.resposta}</Linha>)}
    {!!faltando.length && <Linha rotulo={conhecidas.length ? 'Não informado' : 'Rotina'}>
      <span className="text-text-muted">{semAnamnese ? 'anamnese indisponível nesta consulta' : conhecidas.length ? faltando.join(', ') : 'disponibilidade, tempo por treino e local não informados'}</span>
    </Linha>}
    <Linha rotulo="Programa" alerta={prog.alerta}>{prog.texto}</Linha>
    <Linha rotulo="Frequência">{c.secoes_indisponiveis.includes('estatisticas') ? <span className="text-text-muted">indisponível nesta consulta</span>
      : <>{freq ?? '—'}{ultimo ? <span className="text-text-muted"> · último treino {tempoRelativo(ultimo)}</span> : null}</>}</Linha>
  </dl>
}

/** Relatos e respostas de saúde que pesam na prescrição, com origem e data. Nunca trunca calado. */
export function AtencaoSaude({ contexto: c, limite }: { contexto: Contexto; limite?: number }) {
  const abertos = c.dores_e_duvidas.filter(r => r.tipo === 'DOR' && !r.respondido)
  const { saude } = lerAnamnese(c)
  const semDores = c.secoes_indisponiveis.includes('dores_duvidas')
  const semAnamnese = c.secoes_indisponiveis.includes('anamnese')
  const itens: ReactNode[] = [
    ...abertos.map((r, i) => <li key={`d${i}`}><span className="font-medium">Dor relatada{r.exercicio ? ` em ${r.exercicio}` : ''}</span>
      <span className="text-text-muted"> · pelo aluno{r.data ? ` em ${fmtDate(r.data)}` : ''}</span><p className="text-text-secondary">{r.descricao}</p></li>),
    ...saude.map((r, i) => <li key={`a${i}`}><span className="font-medium">{r.resposta}</span>
      <span className="text-text-muted"> · anamnese{c.anamnese?.preenchido_em ? ` de ${fmtDate(c.anamnese.preenchido_em)}` : ''}: “{r.pergunta}”</span></li>),
  ]
  const visiveis = limite != null ? itens.slice(0, limite) : itens
  const resto = itens.length - visiveis.length
  if (!itens.length && !semDores && !semAnamnese) return <p className="text-xs text-text-muted">
    {c.anamnese ? 'Nenhuma dor em aberto nem restrição de saúde na anamnese.' : 'Nenhuma dor em aberto. A anamnese ainda não foi respondida.'}
  </p>
  return <div className="space-y-2">
    {(semDores || semAnamnese) && <Alert tone="warning">Não foi possível carregar {[semDores && 'os relatos de dor', semAnamnese && 'a anamnese'].filter(Boolean).join(' e ')}. Confira antes de prescrever.</Alert>}
    {!!visiveis.length && <div className="rounded-xl border border-warning/40 bg-warning/5 px-3 py-2">
      <p className="text-xs font-semibold text-warning flex items-center gap-1.5 mb-1"><AlertTriangle size={13} /> Atenção para a prescrição</p>
      <ul className="space-y-1.5 text-sm">{visiveis}</ul>
      {resto > 0 && <p className="text-xs text-text-muted mt-1.5">+ {resto} {resto > 1 ? 'outros itens' : 'outro item'} — veja todos na ficha.</p>}
    </div>}
  </div>
}

export function Restricoes({ contexto }: { contexto: Contexto }) {
  const respondidas = contexto.dores_e_duvidas.filter(x => x.tipo === 'DOR' && x.respondido)
  const semAnamnese = contexto.secoes_indisponiveis.includes('anamnese')
  return <Card variant="elevated">
    <SectionTitle icon={<AlertTriangle size={16} />}>Saúde e restrições informadas</SectionTitle>
    <AtencaoSaude contexto={contexto} />
    {!!respondidas.length && <details className="mt-3">
      <summary className="cursor-pointer text-xs text-text-secondary">{respondidas.length} relato{respondidas.length > 1 ? 's' : ''} de dor já respondido{respondidas.length > 1 ? 's' : ''}</summary>
      <ul className="mt-2 space-y-2">{respondidas.map((r, i) => <li key={i} className="text-sm">
        <span className="font-medium">Dor{r.exercicio ? ` em ${r.exercicio}` : ''}</span>{r.data && <span className="text-xs text-text-muted"> · {fmtDate(r.data)}</span>}
        <p className="text-text-secondary">{r.descricao}</p>
        {r.resposta_do_personal && <p className="text-xs text-text-muted">Sua resposta: {r.resposta_do_personal}</p>}
      </li>)}</ul>
    </details>}
    <div className="border-t border-border pt-3 mt-3">
      <p className="text-xs font-semibold text-text-secondary flex items-center gap-1.5 mb-2"><ClipboardList size={13} /> Anamnese{contexto.anamnese?.preenchido_em ? ` · respondida em ${fmtDate(contexto.anamnese.preenchido_em)}` : ''}</p>
      {semAnamnese ? <p className="text-xs text-text-muted">Indisponível nesta consulta.</p>
        : contexto.anamnese?.respostas.length ? <RespostasAnamnese respostas={contexto.anamnese.respostas} />
        : <p className="text-xs text-text-muted">O aluno ainda não respondeu a anamnese.</p>}
    </div>
  </Card>
}

/** O que o aluno respondeu de fato em destaque; os "não" viram uma linha, abrível. */
function RespostasAnamnese({ respostas }: { respostas: { pergunta: string; resposta: string }[] }) {
  const legiveis = respostas.map(r => ({ ...r, resposta: respostaLegivel(r.resposta) }))
  const relevantes = legiveis.filter(r => !respostaNegativa(r.resposta))
  const negativas = legiveis.filter(r => respostaNegativa(r.resposta))
  return <div className="space-y-2">
    {!!relevantes.length && <dl className="divide-y divide-border">{relevantes.map((r, i) => <div key={i} className="py-1.5 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs text-text-muted">{r.pergunta}</dt>
      <dd className="text-sm text-text break-words">{r.resposta}</dd>
    </div>)}</dl>}
    {!!negativas.length && <details className="text-xs">
      <summary className="cursor-pointer text-text-secondary">Respondeu “não” a {negativas.length} pergunta{negativas.length > 1 ? 's' : ''}</summary>
      <ul className="mt-1.5 space-y-0.5 text-text-muted list-disc pl-4">{negativas.map((r, i) => <li key={i}>{r.pergunta}</li>)}</ul>
    </details>}
  </div>
}

/** Dados completos só sob pedido: não entram no contexto até o personal clicar.
 *  Use com `key={alunoId}` — o estado é do aluno, nunca sobrevive à troca. */
export function DadosPrivados({ host, alunoId }: { host: Host; alunoId: string }) {
  const [data, setData] = useState<Contexto>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const atual = useRef(alunoId)
  useEffect(() => { atual.current = alunoId; setData(undefined); setError('') }, [alunoId])
  async function load() {
    const alvo = alunoId
    setBusy(true); setError('')
    try {
      const r = await host.call('detalhar_aluno', { aluno_id: alvo })
      if (alvo === atual.current) setData((r.structuredContent as { contexto_aluno?: Contexto })?.contexto_aluno)
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar.') } finally { setBusy(false) }
  }
  const c = data
  return <Card variant="elevated">
    <SectionTitle icon={<Lock size={16} />} aside={!c && <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>{busy ? 'Carregando…' : 'Carregar'}</Button>}>Avaliações, metas e notas</SectionTitle>
    {!c && !error && <p className="text-xs text-text-muted">Avaliações físicas, metas e suas anotações. Carregue só quando precisar revisar.</p>}
    {error && <Alert tone="danger" role="alert">{error}</Alert>}
    {c && <div className="space-y-4 text-sm">
      {(c.perfil.descricao || c.perfil.observacoes_do_personal) && <Secao titulo="Perfil">
        {c.perfil.descricao && <p>{c.perfil.descricao}</p>}
        {c.perfil.observacoes_do_personal && <p className="text-text-secondary">Suas observações: {c.perfil.observacoes_do_personal}</p>}
      </Secao>}
      <Secao titulo="Avaliações físicas" vazio={!c.avaliacoes_fisicas?.length && 'Nenhuma avaliação registrada.'}>
        <ul className="space-y-1">{[...(c.avaliacoes_fisicas ?? [])].reverse().slice(0, 3).map((a, i) => <li key={i}>
          <span className="text-text-muted">{fmtDate(a.data) ?? 'Sem data'}: </span>
          {[a.peso_kg != null && `${a.peso_kg} kg`, a.altura_cm != null && `${a.altura_cm} cm`, a.percentual_gordura != null && `${a.percentual_gordura}% de gordura`].filter(Boolean).join(' · ') || 'sem medidas principais'}
        </li>)}</ul>
      </Secao>
      <Secao titulo="Metas" vazio={!c.metas?.length && 'Nenhuma meta cadastrada.'}>
        <ul className="space-y-1">{c.metas?.map((m, i) => <li key={i}>{m.titulo}{m.valor_alvo != null && ` — ${m.valor_alvo}${m.unidade ? ` ${m.unidade}` : ''}`}{m.data_limite && <span className="text-text-muted"> · até {fmtDate(m.data_limite)}</span>}</li>)}</ul>
      </Secao>
      <Secao titulo="Suas notas" vazio={!c.notas_do_personal?.length && 'Nenhuma nota.'}>
        <ul className="space-y-1">{c.notas_do_personal?.map((n, i) => <li key={i}>{n.data && <span className="text-text-muted">{fmtDate(n.data)}: </span>}{n.texto}</li>)}</ul>
      </Secao>
      <p className="text-[11px] text-text-muted">Consultado em {fmtDateTime(c.gerado_em) ?? 'agora'}.</p>
    </div>}
  </Card>
}

function Secao({ titulo, vazio, children }: { titulo: string; vazio?: string | false; children: ReactNode }) {
  return <section><h4 className="text-xs font-semibold text-text-secondary mb-1">{titulo}</h4>{vazio ? <p className="text-xs text-text-muted">{vazio}</p> : children}</section>
}

export function RestricoesDaProposta({ host, alunoId }: { host: Host; alunoId: string }) {
  const [contexto, setContexto] = useState<Contexto>()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setContexto(undefined); setError('')
    void host.call('mostrar_aluno', { aluno_id: alunoId }).then(r => { if (active) setContexto(unpack(r).detalhes.contexto_aluno) })
      .catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [host, alunoId])
  if (contexto) return <AtencaoSaude contexto={contexto} />
  return error ? <Alert tone="warning">Não foi possível carregar as restrições. Confira os dados do aluno.</Alert>
    : <p className="text-sm text-text-muted">Carregando restrições informadas…</p>
}
