import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, Search, Users, Bot } from 'lucide-react'
import { useAlunosPaginated, useCreateAluno, useUpdateAluno } from '../hooks/useAlunos'
import { Button, Card, Input, Spinner, ErrorText, Modal, Avatar, Badge, EmptyState } from '../components/ui'
import { PhoneInput } from '../components/PhoneInput'
import type { AlunoExistenteConflict } from '../types'

export function AlunosPage() {
  const navigate = useNavigate()
  const { data: alunos, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useAlunosPaginated()
  const create = useCreateAluno()
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
  const reativar = useUpdateAluno(conflict?.aluno_existente?.aluno_id ?? '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setConflict(null)
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
      <div className="flex items-center justify-between mb-6 gap-3">
        <h2 className="font-display text-xl font-semibold">Alunos</h2>
        <Button onClick={() => setOpen(true)}>
          <span className="flex items-center gap-1"><Plus size={16} /> Novo aluno</span>
        </Button>
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
                    <p className="font-medium truncate">{a.nome}</p>
                    <p className="text-xs text-text-muted truncate">{a.telefone}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge tone={a.status === 'ATIVO' ? 'success' : 'neutral'}>{a.status}</Badge>
                      <Badge tone={a.agente_habilitado ? 'success' : 'neutral'} className="flex items-center gap-0.5">
                        <Bot size={10} />{a.agente_habilitado ? 'Agente ativo' : 'Agente inativo'}
                      </Badge>
                    </div>
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
