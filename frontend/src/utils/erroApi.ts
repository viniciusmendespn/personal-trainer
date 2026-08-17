/**
 * Leitura do erro da API num formato só.
 *
 * O backend levanta `HTTPException(400, detail={code, ...})`, e o FastAPI serializa isso como
 * `{"detail": {code, ...}}` — um nível mais fundo do que parece. Ler `data.code` direto dava
 * `undefined` e interpolar `data.detail` num template string dava `[object Object]`: era esse o
 * "Erro ao importar. Tente novamente. ([object Object])" que o personal via em toda falha de
 * import por IA.
 *
 * Quatro formas reais chegam aqui:
 *  - `detail` objeto  → contrato de import (`code`, `mensagem`, `problemas`, `relatorio_ia`)
 *  - `detail` string  → resto da API (`raise HTTPException(404, "Aluno não encontrado")`)
 *  - `detail` array   → 422 nativo do FastAPI (body que nem chegou no handler)
 *  - sem `response`   → rede, timeout, CORS
 */

/** Um problema no JSON, no formato do `Achado` do backend (validacao_programa.py). */
export interface ProblemaImport {
  codigo: string
  /** Caminho navegável: `treinos[2].exercicios[0].unidade_reps` */
  campo: string
  /** Onde o humano se localiza: `Treino C › "Bike Erg"` */
  onde: string
  mensagem: string
  /** O que escrever no lugar — é isto que faz a IA se corrigir sozinha. */
  correcao: string
}

export interface ErroImport {
  code?: string
  mensagem: string
  problemas: ProblemaImport[]
  /** Total real de problemas; `problemas` vem cortado em 20. */
  total: number
  /** Texto pronto para o personal colar na conversa com a IA. */
  relatorioIa?: string
}

const GENERICO = 'Não foi possível concluir. Tente novamente.'

function detailDe(err: unknown): unknown {
  const e = err as { response?: { data?: { detail?: unknown } } }
  return e?.response?.data?.detail
}

/** Mensagem curta, para toast. Serve para qualquer erro da API. */
export function mensagemDeErro(err: unknown, fallback = GENERICO): string {
  const detail = detailDe(err)
  if (typeof detail === 'string' && detail.trim()) return detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const d = detail as { mensagem?: string; detail?: string; code?: string }
    if (d.mensagem) return d.mensagem
    if (typeof d.detail === 'string' && d.detail) return d.detail
  }
  if (Array.isArray(detail)) {
    const primeiro = problemasDe422(detail)[0]
    if (primeiro) return `${primeiro.mensagem} (${primeiro.campo})`
  }
  const semResposta = !(err as { response?: unknown })?.response
  if (semResposta) return 'Sem resposta do servidor. Verifique a conexão e tente novamente.'
  return fallback
}

/** 422 nativo do FastAPI: `[{loc, msg, type, input}]` → problemas no nosso formato. */
function problemasDe422(itens: unknown[]): ProblemaImport[] {
  return itens.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const it = item as { loc?: unknown[]; msg?: string }
    const campo = (it.loc ?? [])
      .filter((p) => p !== 'body')
      .map((p) => (typeof p === 'number' ? `[${p}]` : `.${p}`))
      .join('')
      .replace(/^\./, '')
    return [{
      codigo: 'CAMPO_INVALIDO',
      campo: campo || '(corpo)',
      onde: 'requisição',
      mensagem: it.msg ?? 'valor inválido',
      correcao: 'corrija o valor deste campo.',
    }]
  })
}

/**
 * Erro de import com a lista de problemas e o relatório colável.
 * Usar quando a tela sabe renderizar problemas; para um toast simples, `mensagemDeErro`.
 */
export function extrairErroImport(err: unknown, fallback = GENERICO): ErroImport {
  const detail = detailDe(err)

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const d = detail as {
      code?: string
      mensagem?: string
      detail?: string
      problemas?: ProblemaImport[]
      total?: number
      relatorio_ia?: string
    }
    const problemas = Array.isArray(d.problemas) ? d.problemas : []
    return {
      code: d.code,
      mensagem: d.mensagem ?? (typeof d.detail === 'string' ? d.detail : fallback),
      problemas,
      total: d.total ?? problemas.length,
      relatorioIa: d.relatorio_ia,
    }
  }

  if (Array.isArray(detail)) {
    const problemas = problemasDe422(detail)
    return {
      code: 'CORPO_INVALIDO',
      mensagem: 'A requisição não chegou no formato esperado.',
      problemas,
      total: problemas.length,
    }
  }

  return { mensagem: mensagemDeErro(err, fallback), problemas: [], total: 0 }
}
