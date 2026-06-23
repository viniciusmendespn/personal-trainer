export function videoUrlComFallback(nome: string, videoUrl?: string | null): string {
  return videoUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(nome)}`
}
