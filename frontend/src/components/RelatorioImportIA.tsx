import { useState } from 'react'
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Copy } from 'lucide-react'
import { Button, useToast } from './ui'
import type { ProblemaImport } from '../utils/erroApi'

interface Props {
  /** Problemas que impediram a importação. Vazio + `avisos` = importou com ressalvas. */
  problemas?: ProblemaImport[]
  /** Total real de problemas — a lista vem cortada em 20 pelo servidor. */
  total?: number
  avisos?: ProblemaImport[]
  /** Texto pronto para colar na IA, montado pelo servidor. */
  relatorioIa?: string
  /** Mensagem de topo. Quando ausente, é derivada da contagem. */
  mensagem?: string
  /** Mostra o estado "sem nenhum problema" (usado pelo "Conferir sem importar"). */
  limpo?: boolean
}

const LIMITE_EXIBIDO = 20

function Achado({ p, tom }: { p: ProblemaImport; tom: 'danger' | 'warning' }) {
  return (
    <li className="space-y-0.5">
      <p className="text-sm font-medium text-text">{p.onde}</p>
      <p className="text-xs text-text-secondary">{p.mensagem}</p>
      <p className={`text-xs ${tom === 'danger' ? 'text-danger' : 'text-warning'}`}>
        → {p.correcao}
      </p>
      <code className="text-[11px] text-text-muted font-mono break-all">{p.campo}</code>
    </li>
  )
}

/**
 * Lista de problemas de um JSON gerado por IA, com o botão que fecha o loop: copiar o
 * relatório e colar de volta na conversa com a IA.
 *
 * Painel e não toast de propósito — o toast auto-fecha em 4s, é estreito e não dá para copiar,
 * e aqui o conteúdo é justamente aquilo que o personal precisa levar para outro lugar.
 */
export function RelatorioImportIA({
  problemas = [],
  total,
  avisos = [],
  relatorioIa,
  mensagem,
  limpo,
}: Props) {
  const [copiado, setCopiado] = useState(false)
  const { show } = useToast()

  const totalProblemas = total ?? problemas.length
  const ocultos = Math.max(0, totalProblemas - problemas.length)

  async function copiar() {
    if (!relatorioIa) return
    try {
      await navigator.clipboard.writeText(relatorioIa)
      setCopiado(true)
      show('Relatório copiado. Cole na conversa com a IA e peça o JSON corrigido.', 'success')
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      show('Não foi possível copiar. Selecione o texto e copie manualmente.', 'error')
    }
  }

  if (limpo && !problemas.length && !avisos.length) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 p-3 flex items-start gap-2">
        <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-success" />
        <p className="text-sm text-text">
          {mensagem ?? 'Nenhum problema encontrado — o JSON está pronto para importar.'}
        </p>
      </div>
    )
  }

  // Sem achado nenhum mas com mensagem: é o erro pego no cliente (JSON quebrado, sem rede).
  // Ainda precisa aparecer — devolver null aqui deixava a tela muda.
  if (!problemas.length && !avisos.length && !mensagem) return null

  const temErro = problemas.length > 0 || (!avisos.length && !!mensagem)
  // Classes literais: o Tailwind extrai estaticamente, então `border-${cor}/30` não gera CSS.
  const moldura = temErro
    ? 'border-danger/30 bg-danger/10'
    : 'border-warning/30 bg-warning/10'

  return (
    <div className={`rounded-lg border ${moldura} p-3 space-y-3`}>
      <div className="flex items-start gap-2">
        {temErro
          ? <AlertCircle size={16} className="shrink-0 mt-0.5 text-danger" />
          : <AlertTriangle size={16} className="shrink-0 mt-0.5 text-warning" />}
        <p className="text-sm font-medium text-text">
          {mensagem ?? (temErro
            ? `${totalProblemas} problema${totalProblemas !== 1 ? 's' : ''} no JSON — nada foi alterado.`
            : `Importado, mas confira ${avisos.length} ponto${avisos.length !== 1 ? 's' : ''}.`)}
        </p>
      </div>

      {problemas.length > 0 && (
        <ul className="space-y-2.5 max-h-72 overflow-y-auto pl-6">
          {problemas.slice(0, LIMITE_EXIBIDO).map((p, i) => (
            <Achado key={`${p.codigo}-${p.campo}-${i}`} p={p} tom="danger" />
          ))}
          {ocultos > 0 && (
            <li className="text-xs text-text-muted">
              …e mais {ocultos} problema{ocultos !== 1 ? 's' : ''} do mesmo tipo.
            </li>
          )}
        </ul>
      )}

      {avisos.length > 0 && (
        <div className="pl-6 space-y-2.5">
          {problemas.length > 0 && (
            <p className="text-xs font-medium text-warning uppercase tracking-wide">
              Avisos
            </p>
          )}
          <ul className="space-y-2.5">
            {avisos.slice(0, LIMITE_EXIBIDO).map((a, i) => (
              <Achado key={`${a.codigo}-${a.campo}-${i}`} p={a} tom="warning" />
            ))}
          </ul>
        </div>
      )}

      {relatorioIa && (
        <div className="pl-6">
          <Button variant="outline" size="sm" onClick={copiar}>
            <span className="flex items-center gap-1.5">
              {copiado ? <Check size={15} /> : <Copy size={15} />}
              {copiado ? 'Copiado' : 'Copiar problemas para a IA'}
            </span>
          </Button>
          <p className="text-xs text-text-muted mt-1.5">
            Cole na mesma conversa e peça o JSON corrigido — a IA recebe o campo, o motivo e a
            correção de cada ponto.
          </p>
        </div>
      )}
    </div>
  )
}
