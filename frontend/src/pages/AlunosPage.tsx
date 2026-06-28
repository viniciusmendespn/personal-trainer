import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Plus, ChevronRight, Search, Users, Bot, Settings, Copy, Clock } from 'lucide-react'
import { useAlunosPaginated, useCreateAluno, useUpdateAluno } from '../hooks/useAlunos'
import { usePlanoStatus } from '../hooks/usePlano'
import { Button, Card, Input, Spinner, ErrorText, Modal, Avatar, Badge, EmptyState, useToast, AutocompleteInput } from '../components/ui'
import { PhoneInput } from '../components/PhoneInput'
import { anamneseApi } from '../api/anamnese'
import { tempoRelativo } from '../utils/datetime'
import type { AlunoExistenteConflict, PlanoLimitConflict } from '../types'

export function AlunosPage() {
  const navigate = useNavigate()
  const { data: alunos, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useAlunosPaginated()
  const create = useCreateAluno()
  const { show } = useToast()
  const gerarLink = useMutation({
    mutationFn: anamneseApi.gerarLink,
    onSuccess: (data) => {
      navigator.clipboard?.writeText(data.url)
      show('Link copiado para a área de transferência!', 'success')
    },
    onError: () => show('Erro ao gerar link.', 'error'),
  })
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ATIVO' | 'INATIVO' | 'TODOS'>('ATIVO')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState<AlunoExistenteConflict | null>(null)
  const [limitConflict, setLimitConflict] = useState<PlanoLimitConflict | null>(null)
  const reativar = useUpdateAluno(conflict?.aluno_existente?.aluno_id ?? '')
  const { data: plano } = usePlanoStatus()
  const limiteAtingido = plano?.alunos_limit != null && plano.alunos_count >= plano.alunos_limit

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setConflict(null)
    setLimitConflict(null)
    try {
      const novo = await create.mutateAsync({
        nome, telefone,
        email: email || undefined, endereco: endereco || undefined,
        data_nascimento: dataNascimento || undefined, objetivo: objetivo || undefined,
      })
      setNome(''); setTelefone(''); setEmail(''); setEndereco(''); setDataNascimento(''); setObjetivo(''); setOpen(false)
      show('Aluno criado! Monte o treino e deixe a IA cadastrar em segundos.', 'success')
      navigate(`/alunos/${novo.aluno_id}`)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (detail?.code === 'PHONE_ALREADY_REGISTERED') {
        setConflict(detail)
      } else if (detail?.code === 'PLAN_ALUNO_LIMIT_EXCEEDED') {
        setLimitConflict(detail)
      } else {
        setError(typeof detail === 'string' ? detail : 'Erro ao criar aluno')
      }
    }
  }

  async function handleReativar() {
    const alvo = conflict?.aluno_existente
    if (!alvo) return
    await reativar.mutateAsync({ status: 'ATIVO' })
    setOpen(false)
    navigate(`/alunos/${alvo.aluno_id}`)
  }

  const objetivoSuggestions = useMemo(
    () => [...new Set((alunos ?? []).map((a) => a.objetivo).filter(Boolean) as string[])].sort(),
    [alunos],
  )

  const filtered = useMemo(() => {
    if (!alunos) return alunos
    const q = query.trim().toLowerCase()
    let base = statusFilter !== 'TODOS' ? alunos.filter((a) => a.status === statusFilter) : alunos
    if (q) base = base.filter((a) => a.nome.toLowerCase().includes(q) || a.telefone.includes(q))
    return [...base].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [alunos, query, statusFilter])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h2 className="font-display text-xl font-semibold">Alunos</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/config?tab=anamnese">
            <Button variant="outline" size="sm">
              <span className="flex items-center gap-1"><Settings size={14} /> Configurar auto-cadastro</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => gerarLink.mutate()} disabled={gerarLink.isPending}>
            <span className="flex items-center gap-1"><Copy size={14} /> Copiar link</span>
          </Button>
          <Button
            onClick={() => setOpen(true)}
            disabled={limiteAtingido}
            title={limiteAtingido ? 'Limite do Plano Grátis atingido — assine o Gestão Pro' : undefined}
          >
            <span className="flex items-center gap-1"><Plus size={16} /> Novo aluno</span>
          </Button>
        </div>
      </div>

      {!!alunos?.length && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Buscar por nome ou telefone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 shrink-0">
            {(['ATIVO', 'INATIVO', 'TODOS'] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'ATIVO' ? 'Ativos' : s === 'INATIVO' ? 'Inativos' : 'Todos'}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Novo aluno">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <PhoneInput label="Telefone" value={telefone} onChange={setTelefone} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Data de nascimento" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
          </div>
          <Input label="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          <AutocompleteInput label="Objetivo" value={objetivo} onChange={setObjetivo} suggestions={objetivoSuggestions} placeholder="Ex.: Perda de peso, ganho de massa…" />
          <ErrorText>{error}</ErrorText>
          {limitConflict && (
            <Card variant="elevated" className="border-accent/40 space-y-2">
              <p className="text-sm text-text-secondary">
                Plano Grátis permite até {limitConflict.limit} alunos. Assine o Gestão Pro para cadastrar alunos ilimitados.
              </p>
              <Link to="/plano" className="text-sm text-accent-hover hover:underline">
                Ver planos
              </Link>
            </Card>
          )}
          {conflict && (
            <Card variant="elevated" className="border-warning/40 space-y-2">
              <p className="text-sm text-text-secondary">{conflict.message}</p>
              {conflict.aluno_existente && (
                conflict.aluno_existente.status === 'INATIVO' ? (
                  <Button type="button" size="sm" variant="energy" onClick={handleReativar} disabled={reativar.isPending}>
                    {reativar.isPending ? 'Reativando…' : `Reativar ${conflict.aluno_existente.nome}`}
                  </Button>
                ) : (
                  <Link
                    to={`/alunos/${conflict.aluno_existente.aluno_id}`}
                    className="text-sm text-accent-hover hover:underline"
                  >
                    Ver {conflict.aluno_existente.nome}
                  </Link>
                )
              )}
            </Card>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      {isLoading ? (
        <Spinner />
      ) : !alunos?.length ? (
        <EmptyState
          icon={<Users />}
          title="Nenhum aluno ainda"
          description="Crie o primeiro aluno para começar a montar treinos e acompanhar evolução."
          action={<Button onClick={() => setOpen(true)}>Cadastrar aluno</Button>}
        />
      ) : !filtered?.length ? (
        <p className="text-text-muted text-sm">
          {query
            ? `Nenhum aluno encontrado para "${query}".`
            : `Nenhum aluno ${statusFilter === 'ATIVO' ? 'ativo' : 'inativo'} cadastrado.`}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((a) => {
              const cardContent = (
                <>
                  <Avatar name={a.nome} imageUrl={a.foto_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium truncate">{a.nome}</p>
                      {a.bloqueado && <Badge tone="warning">Bloqueado</Badge>}
                      {!a.bloqueado && a.status === 'INATIVO' && <Badge tone="neutral">Inativo</Badge>}
                      {!a.bloqueado && a.agente_habilitado && (
                        <Bot size={12} className="text-success shrink-0" aria-label="Agente ativo" />
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate">{a.telefone}</p>
                    <p className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
                      <Clock size={10} className="shrink-0" /> Atualizado {tempoRelativo(a.updated_at)}
                    </p>
                  </div>
                  {!a.bloqueado && <ChevronRight size={18} className="text-text-muted shrink-0" />}
                </>
              )
              return a.bloqueado ? (
                <div key={a.aluno_id} className="cursor-not-allowed opacity-60">
                  <Card variant="elevated" className="flex items-center gap-3 h-full pointer-events-none">
                    {cardContent}
                  </Card>
                </div>
              ) : (
                <Link key={a.aluno_id} to={`/alunos/${a.aluno_id}`}>
                  <Card variant="elevated" className="flex items-center gap-3 hover:border-accent/50 transition-colors h-full">
                    {cardContent}
                  </Card>
                </Link>
              )
            })}
          </div>
          {hasNextPage && !query && (
            <div className="flex justify-center mt-4">
              <Button variant="ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
