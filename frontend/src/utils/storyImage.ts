import satori from 'satori'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import resvgWasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url'
import { buildStoryTree } from '../components/historico/StoryShareCard'
import type { HistoricoMes } from '../api/alunoApp'

// ── Inicialização única do wasm do resvg ─────────────────────────────────────
let resvgReady: Promise<unknown> | null = null
function ensureResvg() {
  if (!resvgReady) resvgReady = initWasm(fetch(resvgWasmUrl))
  return resvgReady
}

// ── Fontes (Satori precisa do binário; woff é suportado, woff2 não) ──────────
type FontDef = { name: string; weight: 400 | 500 | 700 | 800; style: 'normal'; data: ArrayBuffer }
let fontsPromise: Promise<FontDef[]> | null = null
function loadFonts(): Promise<FontDef[]> {
  if (!fontsPromise) {
    const spec: Array<[string, FontDef['weight'], string]> = [
      ['Inter', 400, '/fonts/Inter-400.woff'],
      ['Inter', 500, '/fonts/Inter-500.woff'],
      ['Inter', 700, '/fonts/Inter-700.woff'],
      ['Sora', 700, '/fonts/Sora-700.woff'],
      ['Sora', 800, '/fonts/Sora-800.woff'],
    ]
    fontsPromise = Promise.all(
      spec.map(async ([name, weight, url]) => ({
        name,
        weight,
        style: 'normal' as const,
        data: await (await fetch(url)).arrayBuffer(),
      })),
    )
  }
  return fontsPromise
}

// ── Helpers de imagem ────────────────────────────────────────────────────────
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Gera o PNG (1080×1920) do story do mês via Satori + resvg. */
export async function buildStoryPng(data: HistoricoMes, nome?: string): Promise<Blob> {
  // 1. Pré-baixa as fotos de check-in p/ dataURL (Satori embute; evita asset externo).
  const urls = new Set<string>()
  for (const sessoes of Object.values(data.dias)) {
    for (const s of sessoes) if (s.checkin_url) urls.add(s.checkin_url)
  }
  const pares = await Promise.all([...urls].map(async (u) => [u, await toDataUrl(u)] as const))
  const photoMap: Record<string, string> = {}
  for (const [u, d] of pares) if (d) photoMap[u] = d

  // 2. Fontes + wasm.
  const [fonts] = await Promise.all([loadFonts(), ensureResvg()])

  // 3. Satori → SVG → PNG.
  const tree = buildStoryTree(data, { nome, photoMap })
  const svg = await satori(tree, { width: 1080, height: 1920, fonts })
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } }).render().asPng()
  return new Blob([new Uint8Array(png)], { type: 'image/png' })
}
