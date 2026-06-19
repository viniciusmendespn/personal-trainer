import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

function calculateSmartBreaks(
  sections: { top: number; bottom: number }[],
  totalHeight: number,
  pageHeight: number,
): number[] {
  const breaks: number[] = []
  let start = 0
  while (start + pageHeight < totalHeight) {
    const natural = start + pageHeight
    const straddle = sections.find((s) => s.top < natural && s.bottom > natural)
    const bp = straddle && straddle.top > start ? straddle.top : natural
    breaks.push(bp)
    start = bp
  }
  return breaks
}

export async function renderNodeToPdf(node: ReactElement, filename: string) {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '-9999px'
  container.style.zIndex = '-1'
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(node)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  try {
    const target = container.firstElementChild as HTMLElement

    // Measure no-break sections before canvas capture
    const targetRect = target.getBoundingClientRect()
    const noBreakSections = Array.from(target.querySelectorAll('[data-no-break]'))
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { top: r.top - targetRect.top, bottom: r.bottom - targetRect.top }
      })
      .filter((s) => s.bottom > s.top)

    const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#ffffff' })

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    // Scale: DOM pixels → PDF points
    const domWidth = target.clientWidth || target.scrollWidth
    const scaleDOMtoPDF = pageWidth / domWidth
    const pageHeightDom = pageHeight / scaleDOMtoPDF
    const totalHeightDom = canvas.height / 2 // canvas was captured at scale:2

    const breaksDom = calculateSmartBreaks(noBreakSections, totalHeightDom, pageHeightDom)
    const allBreaks = [0, ...breaksDom, totalHeightDom]

    // Full-page canvas height (in canvas pixels at scale:2)
    const pageCanvasH = Math.round(pageHeight * canvas.width / pageWidth)

    for (let i = 0; i < allBreaks.length - 1; i++) {
      const startCanvas = Math.round(allBreaks[i] * 2)
      const endCanvas = Math.round(allBreaks[i + 1] * 2)
      const sliceH = endCanvas - startCanvas

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = pageCanvasH
      const ctx = pageCanvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      ctx.drawImage(canvas, 0, startCanvas, canvas.width, sliceH, 0, 0, canvas.width, sliceH)

      if (i > 0) pdf.addPage()
      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight)
    }

    pdf.save(filename)
  } finally {
    root.unmount()
    container.remove()
  }
}
