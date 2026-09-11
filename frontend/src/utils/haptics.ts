// Retorno tátil (vibração) do app do aluno — o paralelo do `beep.ts` para o toque.
//
// SUPORTE: a Vibration API é Android (Chrome/Edge/Firefox/Samsung). O iOS não implementa —
// `navigator.vibrate` é `undefined` em todo browser do iPhone, porque todos rodam sobre WebKit.
// Logo, no iOS este módulo é um no-op silencioso e nada pode depender dele: o som (`beep.ts`)
// e o visual seguem sendo os canais primários.
//
// ATIVAÇÃO: o Chrome recusa `vibrate()` enquanto o documento nunca recebeu um toque — só loga
// e devolve `false`, não lança. Por isso `iniciar()` vibra: além do feedback, serve de primer,
// igual ao `unlockAudio()`.
//
// BACKGROUND: por spec, `vibrate()` é abortado com o documento oculto. A vibração de fim de
// intervalo pode não sair com a tela apagada — limite da API, mitigado pelo wake lock, pelo
// alarme sonoro e pelo PiP, não aqui.

/**
 * Níveis semânticos, em duas famílias.
 * Gesto — resposta a um toque do aluno: `toque`, `impacto`, `sucesso`.
 * Evento do relógio — o cronômetro avisando sozinho: `virada`, `alerta`, `urgente`.
 */
export type NivelHaptico = 'toque' | 'impacto' | 'sucesso' | 'virada' | 'alerta' | 'urgente'

// `sucesso`/`virada`/`alerta`/`urgente` são EXATAMENTE os literais que viviam soltos no
// CronometroProvider — mexer aqui muda a sensação de fim de intervalo do app inteiro.
const PADROES: Record<NivelHaptico, number | number[]> = {
  toque: 10,                            // abrir/fechar exercício, chips de ajuste
  impacto: 25,                          // play/pause/reset/parar
  sucesso: 80,                          // +1 round, Terminei!
  virada: [120, 60, 120],               // EMOM entrou no próximo intervalo
  alerta: [200, 100, 200],              // o tempo acabou
  urgente: [300, 100, 300, 100, 300],   // time cap do For Time estourado
}

/**
 * Se o aparelho/browser tem a API. Guardamos por `typeof navigator` e não por `window`: o Node 21+
 * define `globalThis.navigator` (só `userAgent`), então checar a função cobre Node 20 e 22 no vitest.
 */
export function hapticsSuportado(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/**
 * Dispara o padrão do nível. Devolve se a API aceitou — `false` também quando não há suporte.
 * Não existe um `parar`: por spec, uma nova chamada a `vibrate()` cancela e substitui a anterior.
 */
export function vibrar(nivel: NivelHaptico): boolean {
  if (!hapticsSuportado()) return false
  try {
    const ok = navigator.vibrate(PADROES[nivel])
    // Recusado = documento oculto ou sem user activation. Legível no chrome://inspect via USB.
    if (!ok) {
      const vis = typeof document !== 'undefined' ? document.visibilityState : '?'
      console.debug('[haptics] vibrate recusado', nivel, vis)
    }
    return ok
  } catch {
    return false
  }
}
