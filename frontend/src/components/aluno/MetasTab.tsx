import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, X, Trash2, Target } from 'lucide-react'
import { metasApi, type Meta, type MetaCreate, type MetaStatus, type MetaTipo } from '../../api/metas'
import { evolucaoApi } from '../../api/evolucao'
import { Button, Card, Input, Textarea, Modal, Spinner, EmptyState, SearchableSelect, useToast, useConfirm } from '../ui'

const TIPO_LABEL: Record<MetaTipo, string> = {
  CARGA: 'Carga PR',
  PESO: 'Peso',
  MEDIDA: 'Medida',
  LIVRE: 'Livre',
}

const TIPO_COLOR: Record<MetaTipo, string> = {
  CARGA: 'bg-energy/10 text-energy',
  PESO: 'bg-info/10 text-info',
  MEDIDA: 'bg-accent/10 text-accent-hover',
  LIVRE: 'bg-surface text-text-secondary',
}

function fmtDate(s?: string) {
  if (!s) return null
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diasRestantes(dataLimite?: string) {
  if (!dataLimite) return null
  const diff = Math.ceil((new Date(dataLimite).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return <span className="text-danger">Vencida</span>
  if (diff === 0) return <span className="text-warning">Vence hoje</span>
  return <span className="text-text-muted">{diff} dia{diff !== 1 ? 's' : ''} restante{diff !== 1 ? 's' : ''}</span>
}

export function MetasTab({ alunoId }: { alunoId: string }) {
  const qc = useQueryClient()
  const { show } = useToast()
  const confirm = useConfirm()
  const [openCreate, setOpenCreate] = useState(false)

  const { data: metas, isLoading } = useQuery({
    queryKey: ['metas', alunoId],
    queryFn: () => metasApi.list(alunoId),
    enabled: !!alunoId,
  })

  const createMeta = useMutation({
    mutationFn: (body: MetaCreate) => metasApi.create(alunoId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metas', alunoId] })
      setOpenCreate(false)
    },
    onError: () => show('Não foi possível criar a meta.', 'error'),
  })

  const alterarStatus = useMutation({
    mutationFn: ({ tsId, status }: { tsId: string; status: MetaStatus }) =>
      metasApi.alterarStatus(alunoId, tsId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metas', alunoId] }),
    onError: () => show('Erro ao alterar status.', 'error'),
  })

  const remover = useMutation({
    mutationFn: (tsId: string) => metasApi.remove(alunoId, tsId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metas', alunoId] }),
    onError: () => show('Não foi possível excluir a meta.', 'error'),
  })

  async function handleRemover(m: Meta) {
    const ok = await confirm({
      title: 'Excluir meta',
      message: `Excluir "${m.titulo}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      tone: 'danger',
    })
    if (ok) remover.mutate(m.ts_id)
  }

  const pendentes = metas?.filter((m) => m.status === 'PENDENTE') ?? []
  const ativas = metas?.filter((m) => m.status === 'APROVADA') ?? []
  const concluidas = metas?.filter((m) => m.status === 'CONCLUIDA') ?? []
  const canceladas = metas?.filter((m) => m.status === 'CANCELADA') ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-text-secondary">{metas?.length ?? 0} meta{(metas?.length ?? 0) !== 1 ? 's' : ''}</span>
        <Button size="sm" onClick={() => setOpenCreate(true)}>
          <span className="flex items-center gap-1"><Plus size={14} /> Nova meta</span>
        </Button>
      </div>

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Nova meta" size="lg">
        <MetaForm
          alunoId={alunoId}
          submitting={createMeta.isPending}
          onSubmit={(body) => createMeta.mutate(body)}
          onCancel={() => setOpenCreate(false)}
        />
      </Modal>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !metas?.length ? (
        <EmptyState icon={<Target />} title="Nenhuma meta ainda" description="Crie a primeira meta para acompanhar o progresso do aluno." />
      ) : (
        <div className="space-y-4">
          {pendentes.length > 0 && (
            <MetaGroup
              label="Pendentes de aprovação"
              metas={pendentes}
              onAprovar={(m) => alterarStatus.mutate({ tsId: m.ts_id, status: 'APROVADA' })}
              onCancelar={(m) => alterarStatus.mutate({ tsId: m.ts_id, status: 'CANCELADA' })}
              onRemover={handleRemover}
            />
          )}
          {ativas.length > 0 && (
            <MetaGroup
              label="Metas ativas"
              metas={ativas}
              onCancelar={(m) => alterarStatus.mutate({ tsId: m.ts_id, status: 'CANCELADA' })}
              onRemover={handleRemover}
            />
          )}
          {concluidas.length > 0 && (
            <MetaGroup label="Concluídas" metas={concluidas} onRemover={handleRemover} />
          )}
          {canceladas.length > 0 && (
            <MetaGroup label="Canceladas" metas={canceladas} onRemover={handleRemover} />
          )}
        </div>
      )}
    </div>
  )
}

function MetaGroup({
  label, metas, onAprovar, onCancelar, onRemover,
}: {
  label: string
  metas: Meta[]
  onAprovar?: (m: Meta) => void
  onCancelar?: (m: Meta) => void
  onRemover: (m: Meta) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{label}</p>
      <div className="space-y-2">
        {metas.map((m) => (
          <MetaCard key={m.meta_id} meta={m} onAprovar={onAprovar} onCancelar={onCancelar} onRemover={onRemover} />
        ))}
      </div>
    </div>
  )
}

function MetaCard({
  meta, onAprovar, onCancelar, onRemover,
}: {
  meta: Meta
  onAprovar?: (m: Meta) => void
  onCancelar?: (m: Meta) => void
  onRemover: (m: Meta) => void
}) {
  return (
    <Card variant="elevated">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TIPO_COLOR[meta.tipo as MetaTipo]}`}>
              {TIPO_LABEL[meta.tipo as MetaTipo]}
            </span>
            {meta.criado_por === 'ALUNO' && (
              <span className="text-[11px] text-text-muted">(proposta pelo aluno)</span>
            )}
          </div>
          <p className="font-medium text-sm leading-tight">{meta.titulo}</p>
          {meta.descricao && <p className="text-xs text-text-secondary mt-0.5">{meta.descricao}</p>}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs text-text-secondary">
              Alvo: <span className="font-semibold text-text">{meta.valor_alvo} {meta.unidade}</span>
              {meta.valor_atingido != null && (
                <> → atingido: <span className="font-semibold text-success">{meta.valor_atingido} {meta.unidade}</span></>
              )}
            </span>
            {meta.data_limite && (
              <span className="text-xs">{diasRestantes(meta.data_limite)}</span>
            )}
          </div>
          {meta.data_conclusao && (
            <p className="text-[11px] text-text-muted mt-1">Concluída em {fmtDate(meta.data_conclusao)}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onAprovar && (
            <Button variant="ghost" size="sm" iconOnly aria-label="Aprovar" onClick={() => onAprovar(meta)} className="hover:text-success">
              <Check size={14} />
            </Button>
          )}
          {onCancelar && meta.status !== 'CANCELADA' && (
            <Button variant="ghost" size="sm" iconOnly aria-label="Cancelar" onClick={() => onCancelar(meta)} className="hover:text-warning">
              <X size={14} />
            </Button>
          )}
          <Button variant="ghost" size="sm" iconOnly aria-label="Excluir" onClick={() => onRemover(meta)} className="hover:text-danger">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function MetaForm({
  alunoId, submitting, onSubmit, onCancel,
}: {
  alunoId: string
  submitting: boolean
  onSubmit: (body: MetaCreate) => void
  onCancel: () => void
}) {
  const [tipo, setTipo] = useState<MetaTipo>('LIVRE')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valorAlvo, setValorAlvo] = useState('')
  const [unidade, setUnidade] = useState('')
  const [exercicioId, setExercicioId] = useState('')
  const [campoMedida, setCampoMedida] = useState('')
  const [dataLimite, setDataLimite] = useState('')

  const { data: exercicios } = useQuery({
    queryKey: ['exercicios-plano', alunoId],
    queryFn: () => evolucaoApi.listExercicios(alunoId),
    enabled: tipo === 'CARGA',
  })

  const exercicioOptions = (exercicios ?? []).map((ex) => ({
    value: ex.exercicio_id,
    label: ex.grupo ? `${ex.nome} (${ex.grupo})` : ex.nome,
  }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo || !valorAlvo) return
    if (tipo === 'CARGA' && !exercicioId) return
    onSubmit({
      tipo, titulo, descricao: descricao || undefined,
      valor_alvo: Number(valorAlvo.replace(',', '.')),
      unidade: unidade || (tipo === 'CARGA' ? 'kg' : tipo === 'PESO' ? 'kg' : ''),
      exercicio_id: tipo === 'CARGA' ? exercicioId : undefined,
      campo_medida: tipo === 'MEDIDA' ? campoMedida || undefined : undefined,
      data_limite: dataLimite || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-xs font-medium text-text-secondary mb-1.5">Tipo</p>
        <div className="flex gap-2 flex-wrap">
          {(['CARGA', 'PESO', 'MEDIDA', 'LIVRE'] as MetaTipo[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTipo(t); setExercicioId('') }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                tipo === t ? 'bg-primary text-white border-primary' : 'border-border text-text-secondary hover:border-border-strong'
              }`}
            >
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Agachar 100 kg" required />
      <Textarea label="Descrição (opcional)" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor alvo" value={valorAlvo} onChange={(e) => setValorAlvo(e.target.value)} placeholder="100" inputMode="decimal" required />
        <Input label="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder={tipo === 'CARGA' ? 'kg' : tipo === 'PESO' ? 'kg' : 'cm'} />
      </div>
      {tipo === 'CARGA' && (
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1.5">Exercício</p>
          <SearchableSelect
            options={exercicioOptions}
            value={exercicioId}
            onChange={setExercicioId}
            placeholder={exercicios ? 'Buscar exercício…' : 'Carregando…'}
          />
        </div>
      )}
      {tipo === 'MEDIDA' && (
        <Input label="Campo de medida (ex.: cintura)" value={campoMedida} onChange={(e) => setCampoMedida(e.target.value)} />
      )}
      <Input label="Data limite (opcional)" type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} />
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={submitting || !titulo || !valorAlvo || (tipo === 'CARGA' && !exercicioId)}>
          {submitting ? 'Salvando…' : 'Criar meta'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}
