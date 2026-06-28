import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle, Loader2 } from 'lucide-react'
import { anamneseApi, type AnamneseTemplate } from '../api/anamnese'
import { Button, Input, Spinner, ObjetivosPicker } from '../components/ui'
import { PhoneInput } from '../components/PhoneInput'

type Etapa = 'dados' | 'questionario' | 'sucesso'

export function CadastroPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cadastro-form', token],
    queryFn: () => anamneseApi.getFormPublico(token),
    enabled: !!token,
    retry: false,
  })

  if (!token) return <Centered><p className="text-text-secondary">Link inválido. Solicite um novo ao seu personal.</p></Centered>
  if (isLoading) return <Centered><Spinner /></Centered>
  if (isError) return <Centered><p className="text-text-secondary">Link inválido ou expirado. Solicite um novo ao seu personal.</p></Centered>

  return <CadastroFlow token={token} template={data!.template} personalNome={data!.personal_nome} personalFotoUrl={data!.personal_foto_url} />
}

function CadastroFlow({
  token, template, personalNome, personalFotoUrl,
}: {
  token: string
  template: AnamneseTemplate
  personalNome: string
  personalFotoUrl?: string
}) {
  const [etapa, setEtapa] = useState<Etapa>('dados')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [objetivos, setObjetivos] = useState<string[]>([])
  const [respostas, setRespostas] = useState<Record<string, unknown>>({})
  const [magicLink, setMagicLink] = useState('')

  const cadastrar = useMutation({
    mutationFn: () =>
      anamneseApi.cadastrar(token, {
        nome, telefone,
        email: email || undefined,
        data_nascimento: nascimento || undefined,
        objetivos: objetivos.length ? objetivos : undefined,
        respostas: Object.keys(respostas).length ? respostas : undefined,
      }),
    onSuccess: (data) => {
      setMagicLink(data.magic_link)
      setEtapa('sucesso')
    },
  })

  const temPerguntas = template.perguntas.length > 0

  function avancarDados(e: React.FormEvent) {
    e.preventDefault()
    if (!nome || !telefone) return
    if (temPerguntas) setEtapa('questionario')
    else cadastrar.mutate()
  }

  function avancarQuestionario(e: React.FormEvent) {
    e.preventDefault()
    cadastrar.mutate()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          {personalFotoUrl ? (
            <img src={personalFotoUrl} alt={personalNome} className="w-16 h-16 rounded-full object-cover border-2 border-energy" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center text-2xl">💪</div>
          )}
          <div>
            <p className="text-text-muted text-sm">Cadastro com</p>
            <h1 className="font-display text-xl font-bold text-text">{personalNome}</h1>
          </div>
          {template.mensagem_boas_vindas && (
            <p className="text-sm text-text-secondary">{template.mensagem_boas_vindas}</p>
          )}
        </div>

        {etapa === 'sucesso' ? (
          <div className="flex flex-col items-center gap-4 text-center py-8">
            <CheckCircle size={48} className="text-success" />
            <h2 className="font-display text-xl font-semibold text-text">Cadastro realizado!</h2>
            <p className="text-sm text-text-secondary">Clique abaixo para acessar seu app de treinos.</p>
            <Button variant="energy" className="w-full text-base py-3" onClick={() => window.location.href = magicLink}>
              Acessar meu app
            </Button>
          </div>
        ) : etapa === 'dados' ? (
          <form onSubmit={avancarDados} className="space-y-4">
            <h2 className="font-semibold text-text">Seus dados</h2>
            <Input label="Nome completo *" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" required />
            <PhoneInput label="Telefone (WhatsApp)" value={telefone} onChange={setTelefone} required />
            {template.solicitar_email && (
              <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
            {template.solicitar_nascimento && (
              <Input label="Data de nascimento" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
            )}
            {template.solicitar_objetivo && (
              <ObjetivosPicker label="Objetivos" value={objetivos} onChange={setObjetivos} />
            )}
            <Button type="submit" variant="energy" className="w-full" disabled={!nome || !telefone || cadastrar.isPending}>
              {temPerguntas ? 'Próximo' : (cadastrar.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar cadastro')}
            </Button>
          </form>
        ) : (
          <form onSubmit={avancarQuestionario} className="space-y-4">
            <h2 className="font-semibold text-text">Questionário</h2>
            {template.perguntas.map((p) => (
              <PerguntaField
                key={p.key}
                pergunta={p}
                value={respostas[p.key] ?? ''}
                onChange={(v) => setRespostas((r) => ({ ...r, [p.key]: v }))}
              />
            ))}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setEtapa('dados')}>Voltar</Button>
              <Button type="submit" variant="energy" className="flex-1" disabled={cadastrar.isPending}>
                {cadastrar.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Concluir cadastro'}
              </Button>
            </div>
          </form>
        )}

        {cadastrar.isError && (
          <p className="text-sm text-danger text-center">Erro ao enviar. Tente novamente.</p>
        )}
      </div>
    </div>
  )
}

function PerguntaField({
  pergunta, value, onChange,
}: {
  pergunta: { key: string; label: string; type: string; options?: string[]; required: boolean; placeholder?: string }
  value: unknown
  onChange: (v: unknown) => void
}) {
  const strVal = value == null ? '' : String(value)

  if (pergunta.type === 'BOOL') {
    return (
      <div>
        <p className="text-xs font-medium text-text-secondary mb-1.5">{pergunta.label}{pergunta.required ? ' *' : ''}</p>
        <div className="flex gap-3">
          {['Sim', 'Não'].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt === 'Sim')}
              className={`px-4 py-2 text-sm rounded-lg border transition ${
                (opt === 'Sim' && value === true) || (opt === 'Não' && value === false)
                  ? 'bg-accent text-white border-accent'
                  : 'border-border text-text-secondary hover:border-border-strong'
              }`}
            >{opt}</button>
          ))}
        </div>
      </div>
    )
  }

  if (pergunta.type === 'SELECT' && pergunta.options?.length) {
    return (
      <div>
        <p className="text-xs font-medium text-text-secondary mb-1.5">{pergunta.label}{pergunta.required ? ' *' : ''}</p>
        <select
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          required={pergunta.required}
          className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="">Selecione…</option>
          {pergunta.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  return (
    <Input
      label={`${pergunta.label}${pergunta.required ? ' *' : ''}`}
      value={strVal}
      onChange={(e) => onChange(e.target.value)}
      placeholder={pergunta.placeholder}
      type={pergunta.type === 'NUMBER' ? 'number' : pergunta.type === 'DATE' ? 'date' : 'text'}
      required={pergunta.required}
    />
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-6 text-center">{children}</div>
}
