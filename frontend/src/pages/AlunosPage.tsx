import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight } from 'lucide-react'
import { useAlunos, useCreateAluno } from '../hooks/useAlunos'
import { Button, Card, Input, Spinner, ErrorText } from '../components/ui'

export function AlunosPage() {
  const { data: alunos, isLoading } = useAlunos()
  const create = useCreateAluno()
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await create.mutateAsync({ nome, telefone, objetivo: objetivo || undefined })
      setNome(''); setTelefone(''); setObjetivo(''); setOpen(false)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Erro ao criar aluno')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Alunos</h2>
        <Button onClick={() => setOpen((v) => !v)}>
          <span className="flex items-center gap-1"><Plus size={16} /> Novo aluno</span>
        </Button>
      </div>

      {open && (
        <Card className="mb-6">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              <Input
                label="Telefone (E.164, ex: 5531999998888)"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                required
              />
            </div>
            <Input label="Objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
            <ErrorText>{error}</ErrorText>
            <div className="flex gap-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : !alunos?.length ? (
        <p className="text-slate-500 text-sm">Nenhum aluno ainda. Crie o primeiro acima.</p>
      ) : (
        <div className="space-y-2">
          {alunos.map((a) => (
            <Link key={a.aluno_id} to={`/alunos/${a.aluno_id}`}>
              <Card className="flex items-center justify-between hover:border-emerald-600/50 transition-colors">
                <div>
                  <p className="font-medium">{a.nome}</p>
                  <p className="text-xs text-slate-500">{a.telefone} · {a.status}</p>
                </div>
                <ChevronRight size={18} className="text-slate-600" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
