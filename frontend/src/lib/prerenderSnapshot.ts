import { createElement } from 'react'

// HTML prerenderizado que veio do S3 dentro de #root (páginas públicas de SEO).
// createRoot apaga esse conteúdo no primeiro render; se o chunk lazy da rota ainda
// não chegou — ou falhou, como acontece quando o renderizador do Google reusa um
// main.js em cache que aponta para chunks de um deploy anterior — a página ficava
// em branco ou virava "Algo deu errado", e o Google marcava "Soft 404".
// Guardamos o snapshot ANTES do createRoot para usá-lo como fallback na mesma URL.

const normalizar = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p)

let snapshot: { path: string; html: string } | null = null

export function capturarPrerender() {
  const html = document.getElementById('root')?.innerHTML.trim()
  if (html) snapshot = { path: normalizar(window.location.pathname), html }
}

/** O HTML prerenderizado desta URL, ou null se a navegação já saiu dela. */
export function prerenderDaUrlAtual(): string | null {
  if (!snapshot || snapshot.path !== normalizar(window.location.pathname)) return null
  return snapshot.html
}

/** Renderiza o conteúdo prerenderizado como estava no HTML servido. */
export function PrerenderFallback({ html }: { html: string }) {
  return createElement('div', { dangerouslySetInnerHTML: { __html: html } })
}
