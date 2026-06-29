/** Compartilha um Blob via Web Share API (mobile). Retorna 'shared', 'cancelled' ou 'unsupported'. */
export async function shareBlob(blob: Blob, filename: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Meu mês de treinos' })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled'
      return 'unsupported'
    }
  }
  return 'unsupported'
}

/** Faz download do Blob como arquivo (fallback desktop / quando o share não está disponível). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
