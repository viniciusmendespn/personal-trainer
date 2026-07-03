import { useCallback, useEffect, useRef, useState } from 'react'

/** O que desenhar no quadro do Picture-in-Picture. */
export interface PiPFrame {
  big: string // ex.: "01:23"
  small?: string // rótulo do exercício
  fg: string // cor do texto principal (hex/rgb)
  bg: string // cor de fundo
}

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
const CANVAS_W = 480
const CANVAS_H = 270

type CanvasWithCapture = HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }
type VideoWithPiP = HTMLVideoElement & { requestPictureInPicture?: () => Promise<PictureInPictureWindow> }

/**
 * Picture-in-Picture do cronômetro (janela flutuante do sistema mostrando só a contagem).
 * Desenha o tempo num <canvas> offscreen, captura como stream de vídeo e pede PiP.
 * Só funciona onde há suporte real (Android Chrome / desktop Chromium) — no iOS Safari não há PiP
 * para conteúdo que não seja vídeo real, então `supported` volta false e o app usa a pílula.
 */
export function useCronometroPiP(getFrame: () => PiPFrame) {
  const supported =
    typeof document !== 'undefined' &&
    document.pictureInPictureEnabled &&
    !isIOS &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'

  const [active, setActive] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const repaintRef = useRef<number | null>(null)
  const getFrameRef = useRef(getFrame)
  getFrameRef.current = getFrame

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { big, small, fg, bg } = getFrameRef.current()
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (small) {
      ctx.fillStyle = fg
      ctx.globalAlpha = 0.7
      ctx.font = '28px system-ui, sans-serif'
      ctx.fillText(small.length > 22 ? small.slice(0, 21) + '…' : small, CANVAS_W / 2, 56)
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = fg
    ctx.font = 'bold 140px system-ui, sans-serif'
    ctx.fillText(big, CANVAS_W / 2, CANVAS_H / 2 + 24)
  }, [])

  const exit = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
    } catch {
      /* noop */
    }
  }, [])

  const enter = useCallback(async () => {
    if (!supported) return
    // Cria canvas + video sob demanda (uma vez).
    if (!canvasRef.current) {
      const c = document.createElement('canvas')
      c.width = CANVAS_W
      c.height = CANVAS_H
      canvasRef.current = c
    }
    if (!videoRef.current) {
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      // Fora da tela, mas anexado (necessário pra alguns browsers permitirem PiP).
      v.style.position = 'fixed'
      v.style.width = '1px'
      v.style.height = '1px'
      v.style.opacity = '0'
      v.style.pointerEvents = 'none'
      document.body.appendChild(v)
      v.addEventListener('leavepictureinpicture', () => setActive(false))
      videoRef.current = v
    }
    paint()
    const canvas = canvasRef.current as CanvasWithCapture
    const video = videoRef.current as VideoWithPiP
    try {
      if (!video.srcObject && canvas.captureStream) {
        video.srcObject = canvas.captureStream(10)
      }
      await video.play()
      await video.requestPictureInPicture?.()
      setActive(true)
    } catch {
      setActive(false)
    }
  }, [supported, paint])

  // Enquanto ativo, repinta periodicamente (garante quadros mesmo pausado/concluído).
  useEffect(() => {
    if (!active) {
      if (repaintRef.current != null) {
        clearInterval(repaintRef.current)
        repaintRef.current = null
      }
      return
    }
    repaintRef.current = window.setInterval(paint, 250)
    return () => {
      if (repaintRef.current != null) clearInterval(repaintRef.current)
      repaintRef.current = null
    }
  }, [active, paint])

  // Limpeza ao desmontar.
  useEffect(() => {
    return () => {
      void exit()
      const v = videoRef.current
      if (v) {
        v.srcObject = null
        v.remove()
        videoRef.current = null
      }
    }
  }, [exit])

  return { supported, active, enter, exit, paint }
}
