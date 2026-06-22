import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const MAX_IMAGE_MB = 25
const MAX_VIDEO_MB = 400
const IMAGE_COMPRESS_THRESHOLD_MB = 1.5
const VIDEO_COMPRESS_THRESHOLD_MB = 15
const IMAGE_MAX_DIMENSION = 1600
const IMAGE_QUALITY = 0.8

export class MediaValidationError extends Error {}

/** Rejeita arquivos absurdamente grandes antes de qualquer processamento (evita travar o navegador). */
export function validateFileSize(file: File): void {
  const sizeMb = file.size / (1024 * 1024)
  if (file.type.startsWith('image/') && sizeMb > MAX_IMAGE_MB) {
    throw new MediaValidationError(`Imagem muito grande (máx. ${MAX_IMAGE_MB}MB).`)
  }
  if (file.type.startsWith('video/') && sizeMb > MAX_VIDEO_MB) {
    throw new MediaValidationError(`Vídeo muito grande (máx. ${MAX_VIDEO_MB}MB). Envie um trecho mais curto.`)
  }
}

/** Redesenha em canvas e reexporta como JPEG. Não mexe em arquivos já pequenos. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= IMAGE_COMPRESS_THRESHOLD_MB * 1024 * 1024) {
    return file
  }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

let ffmpegLoadPromise: Promise<FFmpeg> | null = null

function loadFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const ffmpeg = new FFmpeg()
      const base = '/ffmpeg'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      return ffmpeg
    })()
  }
  return ffmpegLoadPromise
}

/**
 * Reescala (máx. 720p, sem upscale) e recodifica em H.264/AAC. Vídeo de execução de exercício
 * não precisa de qualidade alta — prioriza tamanho de arquivo sobre fidelidade visual.
 * Se a compressão falhar por qualquer motivo, devolve o arquivo original (já validado por tamanho).
 */
export async function compressVideo(file: File, onProgress?: (ratio: number) => void): Promise<File> {
  if (!file.type.startsWith('video/') || file.size <= VIDEO_COMPRESS_THRESHOLD_MB * 1024 * 1024) {
    return file
  }
  let ffmpeg: FFmpeg
  try {
    ffmpeg = await loadFFmpeg()
  } catch (e) {
    console.warn('[media] ffmpeg.wasm não carregou, enviando vídeo original', e)
    return file
  }

  const progressHandler = onProgress
    ? ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)))
    : undefined
  const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.mp4')
  const outputName = 'output.mp4'

  try {
    if (progressHandler) ffmpeg.on('progress', progressHandler)
    await ffmpeg.writeFile(inputName, await fetchFile(file))
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', 'scale=w=1280:h=720:force_original_aspect_ratio=decrease',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
      '-c:a', 'aac', '-b:a', '96k',
      outputName,
    ])
    const data = await ffmpeg.readFile(outputName)
    const blob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' })
    if (blob.size >= file.size) return file
    const name = file.name.replace(/\.\w+$/, '') + '.mp4'
    return new File([blob], name, { type: 'video/mp4' })
  } catch (e) {
    console.warn('[media] compressão de vídeo falhou, enviando original', e)
    return file
  } finally {
    if (progressHandler) ffmpeg.off('progress', progressHandler)
    await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
  }
}

/** Valida tamanho e comprime (imagem ou vídeo) antes do upload. Lança MediaValidationError se reprovar. */
export async function prepareMediaForUpload(file: File, onProgress?: (ratio: number) => void): Promise<File> {
  validateFileSize(file)
  if (file.type.startsWith('image/')) return compressImage(file)
  if (file.type.startsWith('video/')) return compressVideo(file, onProgress)
  return file
}
