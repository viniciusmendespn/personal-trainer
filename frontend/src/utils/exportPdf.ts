import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export async function renderNodeToPdf(node: ReactElement, filename: string) {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '-9999px'
  container.style.zIndex = '-1'
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(node)
  // dá um tick para o layout assentar antes de capturar
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  try {
    const target = container.firstElementChild as HTMLElement
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    pdf.save(filename)
  } finally {
    root.unmount()
    container.remove()
  }
}
