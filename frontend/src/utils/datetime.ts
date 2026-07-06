/** Duração legível a partir de segundos: "1h 30min" / "48min" / "45s". Retorna null se vazio. */
export function formatDuracao(s?: number | null): string | null {
  if (!s || s <= 0) return null
  const m = Math.floor(s / 60)
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`
  if (m > 0) return `${m}min`
  return `${Math.round(s)}s`
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
