import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Copy, ExternalLink } from 'lucide-react'
import { anamneseApi, type AnamneseTemplate, type PerguntaAnamnese } from '../../api/anamnese'
import { Button, Card, Input, Spinner, useToast } from '../ui'

const TIPO_LABEL: Record<string, string> = {
  TEXT: 'Texto',
  NUMBER: 'Número',
  BOOL: 'Sim/Não',
  SELECT: 'Seleção',
  DATE: 'Data',
}

export function AnamneseEditor() {
  const qc = useQueryClient()
  const { show } = useToast()

  const { data: template, isLoading } = useQuery({
    queryKey: ['anamnese-template'],
    queryFn: anamneseApi.getTemplate,
  })

  const [perguntas, setPerguntas] = useState<PerguntaAnamnese[]>([])
  const [boasVindas, setBoasVindas] = useState('')
  const [solEmail, setSolEmail] = useState(true)
  const [solNascimento, setSolNascimento] = useState(true)
  const [solObjetivo, setSolObjetivo] = useState(true)
  const [initialized, setInitialized] = useState(false)

  if (template && !initialized) {
    setPerguntas(template.perguntas)
    setBoasVindas(template.mensagem_boas_vindas)
    setSolEmail(template.solicitar_email)
    setSolNascimento(template.solicitar_nascimento)
    setSolObjetivo(template.solicitar_objetivo)
    setInitialized(true)
  }

  const saveTemplate = useMutation({
    mutationFn: (body: AnamneseTemplate) => anamneseApi.saveTemplate(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anamnese-template'] })
      show('Template salvo!', 'success')
    },
    onError: () => show('Erro ao salvar template.', 'error'),
  })

  const gerarLink = useMutation({
    mutationFn: anamneseApi.gerarLink,
    onSuccess: (data) => {
      navigator.clipboard?.writeText(data.url)
      show('Link copiado para a área de transferência!', 'success')
    },
    onError: () => show('Erro ao gerar link.', 'error'),
  })

  function addPergunta() {
    const key = `pergunta_${Date.now()}`
    setPerguntas((ps) => [...ps, { key, label: '', type: 'TEXT', required: false }])
  }

  function updatePergunta(i: number, patch: Partial<PerguntaAnamnese>) {
    setPerguntas((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  }

  function removePergunta(i: number) {
    setPerguntas((ps) => ps.filter((_, j) => j !== i))
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    saveTemplate.mutate({
      perguntas,
      mensagem_boas_vindas: boasVindas,
      solicitar_email: solEmail,
      solicitar_nascimento: solNascimento,
      solicitar_objetivo: solObjetivo,
    })
  }

  if (isLoading) return <div className="flex justify-center py-6"><Spinner /></div>

  return (
    <Card variant="elevated">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text">Formulário de anamnese</h3>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => gerarLink.mutate()}
            disabled={gerarLink.isPending}
          >
            <span className="flex items-center gap-1"><Copy size={13} /> Copiar link de cadastro</span>
          </Button>
        </div>
      </div>

      <form onSubmit={save} className="space-y-5">
        <Input
          label="Mensagem de boas-vindas (opcional)"
          value={boasVindas}
          onChange={(e) => setBoasVindas(e.target.value)}
          placeholder="Ex.: Bem-vindo! Preencha os dados para iniciarmos juntos."
        />

        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Dados básicos (sempre solicitados: Nome e Telefone)</p>
          <div className="flex gap-4 flex-wrap">
            <Toggle label="E-mail" value={solEmail} onChange={setSolEmail} />
            <Toggle label="Data de nascimento" value={solNascimento} onChange={setSolNascimento} />
            <Toggle label="Objetivo" value={solObjetivo} onChange={setSolObjetivo} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Perguntas customizadas</p>
          <div className="space-y-3">
            {perguntas.map((p, i) => (
              <div key={p.key} className="p-3 rounded-xl border border-border bg-surface space-y-2">
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Pergunta (ex.: Tem alguma lesão?)"
                    value={p.label}
                    onChange={(e) => updatePergunta(i, { label: e.target.value })}
                  />
                  <select
                    value={p.type}
                    onChange={(e) => updatePergunta(i, { type: e.target.value as PerguntaAnamnese['type'] })}
                    className="px-2 py-1.5 rounded-xl border border-border bg-surface-elevated text-sm text-text"
                  >
                    {Object.entries(TIPO_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <Button type="button" variant="ghost" size="sm" iconOnly aria-label="Remover" onClick={() => removePergunta(i)} className="hover:text-danger">
                    <Trash2 size={14} />
                  </Button>
                </div>
                {p.type === 'SELECT' && (
                  <Input
                    placeholder="Opções separadas por vírgula (ex.: Sim, Não, Às vezes)"
                    value={p.options?.join(', ') ?? ''}
                    onChange={(e) => updatePergunta(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  />
                )}
                <div className="flex items-center gap-2">
                  <input
                    id={`req-${i}`} type="checkbox" checked={p.required}
                    onChange={(e) => updatePergunta(i, { required: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <label htmlFor={`req-${i}`} className="text-xs text-text-secondary">Obrigatória</label>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addPergunta}>
            <span className="flex items-center gap-1"><Plus size={14} /> Adicionar pergunta</span>
          </Button>
        </div>

        <Button type="submit" disabled={saveTemplate.isPending}>
          {saveTemplate.isPending ? 'Salvando…' : 'Salvar template'}
        </Button>
      </form>

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-text-secondary flex items-center gap-1">
          <ExternalLink size={12} /> O link de cadastro abre uma página pública onde o aluno preenche seus dados e acessa o app automaticamente.
        </p>
      </div>
    </Card>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-primary" />
      {label}
    </label>
  )
}
