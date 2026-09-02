// Rascunho local das séries digitadas durante um treino.
//
// O que o aluno digita antes de tocar em "Registrar" só existia em `useState`: recolher o
// exercício, trocar de aba ou recarregar a PWA apagava tudo e ele redigitava. Aqui o rascunho
// sobrevive a essas três coisas — e só a elas.
//
// O escopo é a SESSÃO: o `sessao_id` fica na raiz do registro, então basta ele não bater com o
// da sessão atual para o rascunho inteiro ser descartado. Sessão nova ⇒ id novo ⇒ campos
// zerados, que é o requisito. Nada disso vai para o backend.
//
// localStorage e não sessionStorage: o caso a resolver é justamente "recarreguei o app", e numa
// PWA standalone (iOS) fechar e reabrir mata o sessionStorage. O escopo por `sessao_id` + a
// limpeza no finish/cancel dão o mesmo isolamento sem depender do ciclo de vida da aba.

const CHAVE = 'pt_sessao_rascunho'

/** Uma linha de série em edição — espelha o shape de `rows` no ExercicioCard. */
export interface LinhaRascunho {
  carga: string
  reps: string
  repsHint: string
  cargaHint: string
  aquecimento: boolean
}

export interface RascunhoExercicio {
  rows: LinhaRascunho[]
  /** Anotação de carga dos blocos pontuáveis (WOD), onde não há linhas de série. */
  cargaAnotada?: string
  /** Nome do substituto escolhido; null = o exercício original. */
  variante?: string | null
}

interface Rascunho {
  sessao_id: string
  exercicios: Record<string, RascunhoExercicio>
}

function ler(): Rascunho | null {
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return null
    const r = JSON.parse(cru) as Rascunho
    if (!r?.sessao_id || typeof r.exercicios !== 'object' || !r.exercicios) return null
    return r
  } catch {
    return null
  }
}

function gravar(r: Rascunho) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(r))
  } catch {
    /* modo privado do Safari / cota estourada — perder o rascunho é aceitável */
  }
}

/** O rascunho DESTA sessão. De outra sessão (ou ilegível), devolve vazio e limpa a chave —
 *  é o que garante que o próximo treino comece zerado. */
export function lerRascunho(sessaoId: string): Record<string, RascunhoExercicio> {
  const r = ler()
  if (!r) return {}
  if (r.sessao_id !== sessaoId) {
    limparRascunhoSessao()
    return {}
  }
  return r.exercicios
}

export function salvarRascunhoEx(sessaoId: string, exercicioId: string, dados: RascunhoExercicio) {
  const atual = ler()
  const exercicios = atual?.sessao_id === sessaoId ? atual.exercicios : {}
  gravar({ sessao_id: sessaoId, exercicios: { ...exercicios, [exercicioId]: dados } })
}

/** Descarta o rascunho de um exercício — usado quando ele é registrado (o servidor virou a verdade). */
export function limparRascunhoEx(sessaoId: string, exercicioId: string) {
  const atual = ler()
  if (!atual || atual.sessao_id !== sessaoId || !(exercicioId in atual.exercicios)) return
  const { [exercicioId]: _descartado, ...resto } = atual.exercicios
  gravar({ sessao_id: sessaoId, exercicios: resto })
}

/** Fim do escopo: treino finalizado ou cancelado. */
export function limparRascunhoSessao() {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    /* ok */
  }
}
