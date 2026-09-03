/** Duração legível a partir de segundos: "1h 30min" / "48min" / "45s". Retorna null se vazio. */
export function formatDuracao(s?: number | null): string | null {
  if (!s || s <= 0) return null
  const m = Math.floor(s / 60)
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`
  if (m > 0) return `${m}min`
  return `${Math.round(s)}s`
}

/** Segunda-feira 00:00 no fuso do aparelho. O backend grava tudo em UTC, então o recorte da
 * semana é feito no cliente — senão um treino de domingo 21h (BRT) cairia na semana seguinte. */
export function inicioSemanaLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** 'YYYY-MM-DD' do dia LOCAL de um Date — chave de dia de calendário.
 *
 * Nunca usar `toISOString().slice(0, 10)` para isso: aquilo devolve o dia UTC, e das 21h em
 * diante (BRT) o dia UTC já é o seguinte. Era o que fazia o compromisso das 21h de terça cair
 * no card da quarta, e o de domingo à noite sumir da semana. */
export function diaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' do dia LOCAL de um instante ISO — chave estável de agrupamento/cache. */
export function diaLocalIso(iso: string): string {
  return diaLocal(new Date(iso))
}

/** Fuso IANA do aparelho, para SUGERIR na configuração — nunca para persistir calado. */
export function fusoDoAparelho(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

/** 'YYYY-MM-DD' do dia de um instante NO FUSO DADO (IANA), não no do aparelho.
 *
 * É o que faz a agenda bater quando o personal viaja: o compromisso continua sendo do dia em
 * que ele foi marcado, no fuso configurado. Fuso ausente ou inválido cai no dia do aparelho —
 * degradar é melhor que quebrar a tela (docs/TIMEZONE.md §4). */
export function diaNoFuso(d: Date, tz?: string | null): string {
  if (!tz) return diaLocal(d)
  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d)
    const get = (t: string) => partes.find((p) => p.type === t)?.value
    const [y, m, dia] = [get('year'), get('month'), get('day')]
    return y && m && dia ? `${y}-${m}-${dia}` : diaLocal(d)
  } catch {
    return diaLocal(d)
  }
}

/** Mesmo que `diaNoFuso`, a partir de um instante ISO. */
export function diaIsoNoFuso(iso: string, tz?: string | null): string {
  return diaNoFuso(new Date(iso), tz)
}

/** Hoje no fuso dado, como Date "porta-calendário" (meia-noite local do aparelho).
 * Serve para navegar semana/mês; nunca use o instante dele para exibir hora. */
export function hojeNoFuso(tz?: string | null): Date {
  const [y, m, d] = diaNoFuso(new Date(), tz).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Partes do relógio de `tz` no instante `d`. Base de tudo abaixo. */
function partesNoFuso(d: Date, tz: string) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d)
  const g = (t: string) => Number(partes.find((p) => p.type === t)?.value)
  // `hour` sai como 24 à meia-noite em alguns engines — normalizar evita o dia pular.
  return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour') % 24, mi: g('minute'), s: g('second') }
}

/** Offset de `tz` em minutos no instante `d` (positivo a leste de Greenwich). */
function offsetMin(d: Date, tz: string): number {
  const p = partesNoFuso(d, tz)
  return (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - d.getTime()) / 60000
}

/** 'HH:MM' de um instante no fuso dado — para exibir hora de compromisso. */
export function horaNoFuso(iso: string, tz?: string | null): string {
  const d = new Date(iso)
  if (!tz) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  try {
    const p = partesNoFuso(d, tz)
    return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`
  } catch {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}

/** ['YYYY-MM-DD', 'HH:MM'] civis de um instante, no fuso dado — preenche formulário de edição. */
export function civilNoFuso(iso: string, tz?: string | null): [string, string] {
  return [diaIsoNoFuso(iso, tz), horaNoFuso(iso, tz)]
}

/** Instante ISO de uma data+hora CIVIL num fuso: ('2026-09-07', '21:00', 'America/Sao_Paulo').
 *
 * Direção inversa de `diaNoFuso`, e a mais delicada: "21:00 do dia 7 em São Paulo" só vira um
 * instante depois de saber o offset vigente NAQUELE dia — que muda com o horário de verão.
 * Daí as duas passadas: a primeira estima o offset, a segunda o corrige caso a estimativa
 * tenha caído do outro lado de uma virada de DST. */
export function instanteDeCivil(data: string, hora: string, tz?: string | null): string {
  if (!tz) return new Date(`${data}T${hora}:00`).toISOString()
  try {
    const comoUtc = new Date(`${data}T${hora}:00Z`)
    const passo1 = new Date(comoUtc.getTime() - offsetMin(comoUtc, tz) * 60000)
    return new Date(comoUtc.getTime() - offsetMin(passo1, tz) * 60000).toISOString()
  } catch {
    return new Date(`${data}T${hora}:00`).toISOString()
  }
}

/** Instantes UTC que delimitam o dia LOCAL de `iso`, semiaberto [inicio, fim). Mesmo motivo de
 * `inicioSemanaLocal`: o backend grava em UTC, então um post de 21h (BRT) é 00h UTC do dia
 * seguinte — recortar por UTC traria o treino do dia errado. */
export function limitesDiaLocal(iso: string): { inicio: string; fim: string } {
  const d = new Date(iso)
  const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 1)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

/** "hoje" ou o dia da semana abreviado sem ponto ("seg", "qua"). */
export function labelDiaCurto(iso: string): string {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return 'hoje'
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

/** ISO da última execução do treino, se ela caiu na semana corrente (local). Senão, null. */
export function feitoNaSemana(ultimaExecucao?: string | null): string | null {
  return ultimaExecucao && new Date(ultimaExecucao) >= inicioSemanaLocal() ? ultimaExecucao : null
}

export function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d}d`
  const mes = Math.floor(d / 30)
  return mes === 1 ? 'há 1 mês' : `há ${mes} meses`
}
