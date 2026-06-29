import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import html2canvas from 'html2canvas'

const STORY_W = 1080
const STORY_H = 1920

/** Renderiza um nó React num container oculto de 1080×1920 e captura como PNG (formato story). */
export async function renderStoryToBlob(node: ReactElement): Promise<Blob> {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '-9999px'
  container.style.zIndex = '-1'
  container.style.width = `${STORY_W}px`
  container.style.height = `${STORY_H}px`
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(node)
  // Espera o React pintar e as imagens (fotos de check-in) carregarem antes de capturar.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const imgs = Array.from(container.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res()
            img.onerror = () => res()
          }),
    ),
  )

  try {
    const target = container.firstElementChild as HTMLElement
    const canvas = await html2canvas(target, {
      width: STORY_W,
      height: STORY_H,
      scale: 1,
      backgroundColor: '#08070d',
      useCORS: true,
    })
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Falha ao gerar a imagem do story')
    return blob
  } finally {
    root.unmount()
    container.remove()
  }
}

/** Gera o story e compartilha via Web Share API (mobile); cai para download no desktop. */
export async function shareOrDownloadStory(node: ReactElement, filename: string): Promise<'shared' | 'downloaded'> {
  const blob = await renderStoryToBlob(node)
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }

  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Meu mês de treinos' })
      return 'shared'
    } catch (e) {
      // Usuário cancelou o share nativo — não força o download.
      if ((e as Error)?.name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
