import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X, Copy, ExternalLink, RotateCcw, Sparkles } from 'lucide-react'
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
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false)

  function aplicar(t: AnamneseTemplate) {
    setPerguntas(t.perguntas)
    setBoasVindas(t.mensagem_boas_vindas)
    setSolEmail(t.solicitar_email)
    setSolNascimento(t.solicitar_nascimento)
    setSolObjetivo(t.solicitar_objetivo)
  }

  if (template && !initialized) {
    aplicar(template)
    setInitialized(true)
  }

  const restaurarPadrao = useMutation({
    mutationFn: anamneseApi.getTemplatePadrao,
    onSuccess: (padrao) => {
      aplicar(padrao)
      setConfirmarRestaurar(false)
      show('Modelo padrão carregado. Clique em "Salvar template" para aplicar.', 'success')
    },
    onError: () => show('Erro ao carregar o modelo padrão.', 'error'),
  })

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

  function addOption(i: number) {
    setPerguntas((ps) => ps.map((p, j) => (j === i ? { ...p, options: [...(p.options ?? []), ''] } : p)))
  }

  function updateOption(i: number, optIdx: number, value: string) {
    setPerguntas((ps) =>
      ps.map((p, j) => (j === i ? { ...p, options: (p.options ?? []).map((o, k) => (k === optIdx ? value : o)) } : p))
    )
  }

  function removeOption(i: number, optIdx: number) {
    setPerguntas((ps) =>
      ps.map((p, j) => (j === i ? { ...p, options: (p.options ?? []).filter((_, k) => k !== optIdx) } : p))
    )
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

      {template?.padrao && (
        <div className="mb-4 p-3 rounded-xl border border-accent/30 bg-accent/10 text-sm text-text-secondary flex gap-2">
          <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
          <p>
            Este é o <strong className="text-text">modelo pronto do CoachPilot</strong> (triagem de saúde PAR-Q,
            histórico, rotina e hábitos) e já está ativo no seu link de cadastro. Edite, remova ou
            acrescente o que quiser e salve para torná-lo seu.
          </p>
        </div>
      )}

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
                <Input
                  placeholder="Pergunta (ex.: Tem alguma lesão?)"
                  value={p.label}
                  onChange={(e) => updatePergunta(i, { label: e.target.value })}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={p.type}
                    onChange={(e) => updatePergunta(i, { type: e.target.value as PerguntaAnamnese['type'] })}
                    className="px-2 py-1.5 rounded-xl border border-border bg-surface-elevated text-sm text-text"
                  >
                    {Object.entries(TIPO_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2">
                    <input
                      id={`req-${i}`} type="checkbox" checked={p.required}
                      onChange={(e) => updatePergunta(i, { required: e.target.checked })}
                      className="w-4 h-4 accent-accent"
                    />
                    <span className="text-xs text-text-secondary">Obrigatória</span>
                  </label>
                  <Button type="button" variant="ghost" size="sm" iconOnly aria-label="Remover" onClick={() => removePergunta(i)} className="hover:text-danger ml-auto">
                    <Trash2 size={14} />
                  </Button>
                </div>
                {p.type === 'SELECT' && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs text-text-secondary">Opções</p>
                    {(p.options ?? []).map((opt, optIdx) => (
                      <div key={optIdx} className="flex gap-2">
                        <Input
                          className="flex-1"
                          placeholder={`Opção ${optIdx + 1}`}
                          value={opt}
                          onChange={(e) => updateOption(i, optIdx, e.target.value)}
                        />
                        <Button
                          type="button" variant="ghost" size="sm" iconOnly aria-label="Remover opção"
                          onClick={() => removeOption(i, optIdx)} className="hover:text-danger"
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => addOption(i)}>
                      <span className="flex items-center gap-1"><Plus size={14} /> Adicionar opção</span>
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addPergunta}>
            <span className="flex items-center gap-1"><Plus size={14} /> Adicionar pergunta</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button type="submit" disabled={saveTemplate.isPending}>
            {saveTemplate.isPending ? 'Salvando…' : 'Salvar template'}
          </Button>
          {confirmarRestaurar ? (
            <span className="flex items-center gap-2 text-xs text-text-secondary">
              Substituir as perguntas atuais pelo modelo padrão?
              <Button type="button" variant="outline" size="sm" onClick={() => restaurarPadrao.mutate()} disabled={restaurarPadrao.isPending}>
                Substituir
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmarRestaurar(false)}>
                Cancelar
              </Button>
            </span>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmarRestaurar(true)}>
              <span className="flex items-center gap-1"><RotateCcw size={13} /> Usar modelo padrão</span>
            </Button>
          )}
        </div>
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
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-accent" />
      {label}
    </label>
  )
}
