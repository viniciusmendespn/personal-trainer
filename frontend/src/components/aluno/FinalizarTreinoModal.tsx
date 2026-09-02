import { useState } from 'react'
import { Button, Modal, Textarea } from '../ui'

export const OBSERVACAO_MAX = 500

/**
 * Confirmação de fim de treino com um comentário curto opcional.
 *
 * Substitui o `useConfirm` que existia aqui — ele só resolve `true`/`false` e não coleta texto.
 * O comentário vive neste momento e não em outro porque é aqui que o aluno vê o que deixou
 * pendente: a lista de não executados fica logo acima do campo, e a justificativa sai na mesma
 * chamada do finish. O texto vai para o histórico e para a notificação do personal.
 */
export function FinalizarTreinoModal({ pendentes, submitting, onConfirm, onClose }: {
  /** Nomes dos exercícios sem registro (nem score de bloco) — pode ser vazio. */
  pendentes: string[]
  submitting?: boolean
  onConfirm: (observacao?: string) => void
  onClose: () => void
}) {
  const [observacao, setObservacao] = useState('')
  const texto = observacao.trim()

  return (
    <Modal open onClose={onClose} title="Finalizar treino?">
      <div className="space-y-4">
        {pendentes.length > 0 ? (
          <div className="space-y-2 text-sm">
            <p>
              {pendentes.length} exercício{pendentes.length > 1 ? 's' : ''} ainda não
              {pendentes.length > 1 ? ' foram executados' : ' foi executado'}:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-text-muted">
              {pendentes.map((nome) => <li key={nome}>{nome}</li>)}
            </ul>
            <p>Deseja finalizar mesmo assim?</p>
          </div>
        ) : (
          <p className="text-sm">Confirma a finalização do treino?</p>
        )}

        <div className="space-y-1.5">
          <Textarea
            label="Comentário (opcional)"
            rows={3}
            maxLength={OBSERVACAO_MAX}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder={pendentes.length > 0
              ? 'Ex.: pulei perna, joelho doendo'
              : 'Como foi o treino hoje?'}
          />
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Seu personal vê isso junto do treino.</span>
            <span className="tabular-nums">{observacao.length}/{OBSERVACAO_MAX}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
            Continuar treinando
          </Button>
          <Button
            variant="energy"
            className="flex-1"
            disabled={submitting}
            onClick={() => onConfirm(texto || undefined)}
          >
            {submitting ? 'Finalizando…' : 'Finalizar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
