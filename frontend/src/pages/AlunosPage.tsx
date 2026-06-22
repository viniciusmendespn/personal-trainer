import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Plus, ChevronRight, Search, Users, Bot, Settings, Copy, Clock } from 'lucide-react'
import { useAlunosPaginated, useCreateAluno, useUpdateAluno } from '../hooks/useAlunos'
import { usePlanoStatus } from '../hooks/usePlano'
import { Button, Card, Input, Spinner, ErrorText, Modal, Avatar, Badge, EmptyState, useToast } from '../components/ui'
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
      await create.mutateAsync({
        nome, telefone,
        email: email || undefined, endereco: endereco || undefined,
        data_nascimento: dataNascimento || undefined, objetivo: objetivo || undefined,
      })
      setNome(''); setTelefone(''); setEmail(''); setEndereco(''); setDataNascimento(''); setObjetivo(''); setOpen(false)
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

  const filtered = useMemo(() => {
    if (!alunos) return alunos
    const q = query.trim().toLowerCase()
    if (!q) return alunos
    return alunos.filter((a) => a.nome.toLowerCase().includes(q) || a.telefone.includes(q))
  }, [alunos, query])

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
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Buscar por nome ou telefone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
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
          <Input label="Objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
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
        <p className="text-text-muted text-sm">Nenhum aluno encontrado para "{query}".</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((a) => (
              <Link key={a.aluno_id} to={`/alunos/${a.aluno_id}`}>
                <Card variant="elevated" className="flex items-center gap-3 hover:border-accent/50 transition-colors h-full">
                  <Avatar name={a.nome} imageUrl={a.foto_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium truncate">{a.nome}</p>
                      {a.status === 'INATIVO' && <Badge tone="neutral">Inativo</Badge>}
                      {a.agente_habilitado && (
                        <Bot size={12} className="text-success shrink-0" aria-label="Agente ativo" />
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate">{a.telefone}</p>
                    <p className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
                      <Clock size={10} className="shrink-0" /> Atualizado {tempoRelativo(a.updated_at)}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-text-muted shrink-0" />
                </Card>
              </Link>
            ))}
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
