import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, Search, Users } from 'lucide-react'
import { useAlunos, useCreateAluno } from '../hooks/useAlunos'
import { Button, Card, Input, Spinner, ErrorText, Modal, Avatar, Badge, EmptyState } from '../components/ui'

export function AlunosPage() {
  const { data: alunos, isLoading } = useAlunos()
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await create.mutateAsync({
        nome, telefone,
        email: email || undefined, endereco: endereco || undefined,
        data_nascimento: dataNascimento || undefined, objetivo: objetivo || undefined,
      })
      setNome(''); setTelefone(''); setEmail(''); setEndereco(''); setDataNascimento(''); setObjetivo(''); setOpen(false)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Erro ao criar aluno')
    }
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
            <Input
              label="Telefone (E.164, ex: 5531999998888)"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Data de nascimento" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
          </div>
          <Input label="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          <Input label="Objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
          <ErrorText>{error}</ErrorText>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((a) => (
            <Link key={a.aluno_id} to={`/alunos/${a.aluno_id}`}>
              <Card variant="elevated" className="flex items-center gap-3 hover:border-accent/50 transition-colors h-full">
                <Avatar name={a.nome} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{a.nome}</p>
                  <p className="text-xs text-text-muted truncate">{a.telefone}</p>
                  <Badge tone={a.status === 'ATIVO' ? 'success' : 'neutral'} className="mt-1">{a.status}</Badge>
                </div>
                <ChevronRight size={18} className="text-text-muted shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
