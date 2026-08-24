import { useMemo, useState } from 'react'
import { Pencil, Search, Trash2, Trophy } from 'lucide-react'
import type { ExercicioEvolucao, PrItem } from '../../api/evolucao'
import { Button, Card, Input, useConfirm } from '../ui'
import { normalizeText } from '../../utils/normalizeText'
import { fmtScoreValor } from '../../utils/wod'
import { normalizeTipoExercicio } from '../../types'
import { EditarPrModal } from './EditarPrModal'

const PAGINA = 12

export function fmtValorPr(p: PrItem, ex?: ExercicioEvolucao): string {
  if (p.wod || p.chave?.startsWith('wod#')) {
    return `${fmtScoreValor(p.formato ?? ex?.formato, p.carga)}${p.rx === false ? ' (adaptado)' : ''}`
  }
  return normalizeTipoExercicio(ex?.tipo_exercicio) === 'PERFORMANCE'
    ? `${p.carga} ${ex?.unidade_reps ?? ''}`.trimEnd()
    : `${p.carga} ${ex?.unidade_carga ?? 'kg'}`
}

/** Aba "Recordes" — a mesma lista no portal e no app do aluno, os dois podendo corrigir.
 * O item de PR só sobe (update_if_greater), então sem esta tela um "600" no lugar de "60"
 * ficaria no exercício para sempre. */
export function RecordesList({ prs, exercicios, salvando, onSalvar, onExcluir }: {
  prs: PrItem[]
  exercicios?: ExercicioEvolucao[]
  salvando?: boolean
  onSalvar: (chave: string, carga: number) => Promise<void>
  onExcluir: (chave: string) => Promise<void>
}) {
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [limite, setLimite] = useState(PAGINA)
  const [editando, setEditando] = useState<PrItem | null>(null)

  const filtrados = useMemo(() => {
    const q = normalizeText(query)
    return q ? prs.filter((p) => normalizeText(p.exercicio).includes(q)) : prs
  }, [prs, query])

  const exDe = (p: PrItem) =>
    exercicios?.find((e) => (p.chave ? e.chave === p.chave : e.nome === p.exercicio))

  if (!prs.length) return <p className="text-text-muted text-sm">Nenhum recorde ainda.</p>

  async function excluir(p: PrItem) {
    const ok = await confirm({
      title: 'Apagar recorde',
      message: `Apagar o recorde de ${p.exercicio} (${fmtValorPr(p, exDe(p))})? O próximo treino
        acima desse valor cria um recorde novo. Para corrigir um valor digitado errado, prefira editar.`,
      confirmLabel: 'Apagar',
      tone: 'danger',
    })
    if (ok && p.chave) await onExcluir(p.chave)
  }

  return (
    <Card variant="elevated">
      <div className="relative mb-3">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <Input placeholder="Buscar exercício…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
      </div>

      {!filtrados.length && <p className="text-text-muted text-sm">Nenhum recorde para essa busca.</p>}

      <div className="divide-y divide-border">
        {filtrados.slice(0, limite).map((p) => (
          <div key={p.chave ?? p.exercicio} className="flex items-center gap-2 py-2 first:pt-0">
            <Trophy size={14} className="text-warning shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text truncate">
                {p.exercicio}: <b className="text-warning">{fmtValorPr(p, exDe(p))}</b>
              </p>
              <p className="text-[11px] text-text-muted">
                {new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                {/* A marca não some depois de um recorde novo: o registro que gerou o valor
                    errado continua no histórico, então o item segue sendo a fonte da verdade. */}
                {p.editado_em && <span className="ml-1.5 text-accent-hover">· corrigido manualmente</span>}
              </p>
            </div>
            {p.chave && (
              <>
                <Button variant="ghost" size="sm" iconOnly aria-label={`Corrigir recorde de ${p.exercicio}`}
                        onClick={() => setEditando(p)}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="sm" iconOnly aria-label={`Apagar recorde de ${p.exercicio}`}
                        onClick={() => excluir(p)}>
                  <Trash2 size={14} className="text-danger" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      {filtrados.length > limite && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setLimite((n) => n + PAGINA)}>
          Carregar mais ({filtrados.length - limite} restantes)
        </Button>
      )}

      {editando && (
        <EditarPrModal
          pr={editando}
          ex={exDe(editando)}
          salvando={salvando}
          onClose={() => setEditando(null)}
          onSalvar={async (carga) => {
            await onSalvar(editando.chave!, carga)
            setEditando(null)
          }}
        />
      )}
    </Card>
  )
}
