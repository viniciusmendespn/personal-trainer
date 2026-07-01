import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const MAX_IMAGE_MB = 25
const MAX_VIDEO_MB = 400
const IMAGE_COMPRESS_THRESHOLD_MB = 1.5
const VIDEO_COMPRESS_THRESHOLD_MB = 15
const VIDEO_BIG_INPUT_MB = 60   // acima disso, comprime mais agressivo p/ caber na memória do celular
const IMAGE_MAX_DIMENSION = 1600
const IMAGE_QUALITY = 0.8

/** Cache-Control aplicado no upload (presigned PUT). As chaves de mídia são content-addressed
 * por uuid, então o conteúdo é imutável. Este header PRECISA ser idêntico ao assinado no
 * backend (media_service.gerar_presigned_upload_url*), senão a assinatura do PUT falha. */
export const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable'

export class MediaValidationError extends Error {}

/** Desfecho da compressão de vídeo — permite à UI mostrar feedback quando caímos no original. */
export type CompressOutcome = {
  status: 'compressed' | 'skipped' | 'fallback'
  reason?: string
  inMB: number
  outMB?: number
}

/** Beacon fire-and-forget de telemetria de mídia (CloudWatch via /v1/public/telemetry/media).
 * Nunca lança nem atrasa o upload — falha de compressão hoje é invisível, isto dá visibilidade. */
function reportMediaTelemetry(payload: Record<string, unknown>): void {
  try {
    const body = JSON.stringify({ ...payload, ua: navigator.userAgent })
    navigator.sendBeacon?.('/v1/public/telemetry/media', new Blob([body], { type: 'application/json' }))
  } catch {
    /* telemetria jamais deve quebrar o fluxo de upload */
  }
}

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

// Versão do core servido em /ffmpeg. Os arquivos NÃO têm hash no nome e são servidos com
// max-age=3600, então o navegador cacheia por até 1h — a invalidação do CloudFront não limpa
// o cache local. Ao trocar o build do core (ex.: umd → esm), BUMPAR esta string força o
// navegador a buscar uma URL nova em vez de reusar o core antigo do cache. Ver [[project_video_compressao]].
const FFMPEG_CORE_VERSION = 'esm-0.12.10'

function loadFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const ffmpeg = new FFmpeg()
      const base = '/ffmpeg'
      const v = FFMPEG_CORE_VERSION
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js?v=${v}`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm?v=${v}`, 'application/wasm'),
      })
      return ffmpeg
    })()
    // Se o load falhar, não deixa a promise rejeitada memoizada pra sessão inteira —
    // permite nova tentativa num próximo upload.
    ffmpegLoadPromise.catch(() => { ffmpegLoadPromise = null })
  }
  return ffmpegLoadPromise
}

/**
 * Reescala (máx. 720p em pé, sem upscale) e recodifica em H.264/AAC com `+faststart` (moov no
 * início → o <video> começa a tocar sem baixar o arquivo todo). Vídeo de execução de exercício
 * não precisa de alta qualidade — prioriza tamanho e streaming sobre fidelidade.
 *
 * Roda dentro de um Web Worker (o próprio @ffmpeg/ffmpeg gerencia isso). O risco real no mobile
 * é MEMÓRIA (input + buffers + output no heap wasm), não a thread — por isso inputs grandes usam
 * cap menor. Se falhar por qualquer motivo, devolve o original (já validado) e emite telemetria,
 * pra que o fallback pare de ser invisível.
 */
export async function compressVideo(
  file: File,
  onProgress?: (ratio: number) => void,
  onOutcome?: (o: CompressOutcome) => void,
): Promise<File> {
  const inMB = file.size / (1024 * 1024)
  if (!file.type.startsWith('video/') || file.size <= VIDEO_COMPRESS_THRESHOLD_MB * 1024 * 1024) {
    onOutcome?.({ status: 'skipped', inMB })
    return file
  }

  let ffmpeg: FFmpeg
  try {
    ffmpeg = await loadFFmpeg()
  } catch (e) {
    const reason = `load: ${e instanceof Error ? e.message : String(e)}`
    console.warn('[media] ffmpeg.wasm não carregou, enviando vídeo original', e)
    reportMediaTelemetry({ event: 'compress_fallback', reason, in_mb: Math.round(inMB) })
    onOutcome?.({ status: 'fallback', reason, inMB })
    return file
  }

  const progressHandler = onProgress
    ? ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)))
    : undefined
  // Guarda as últimas linhas do log do ffmpeg: a razão de um abort/OOM aparece aí.
  const logTail: string[] = []
  const logHandler = ({ message }: { message: string }) => {
    logTail.push(message)
    if (logTail.length > 20) logTail.shift()
  }
  const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.mp4')
  const outputName = 'output.mp4'

  // Inputs grandes: cap mais agressivo (480p/CRF32) pra reduzir o pico de memória no celular.
  const big = file.size > VIDEO_BIG_INPUT_MB * 1024 * 1024
  const capW = big ? 480 : 720
  const capH = big ? 854 : 1280
  const crf = big ? '32' : '30'

  let inputDeleted = false
  try {
    if (progressHandler) ffmpeg.on('progress', progressHandler)
    ffmpeg.on('log', logHandler)
    await ffmpeg.writeFile(inputName, await fetchFile(file))
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', `scale='min(${capW},iw)':'min(${capH},ih)':force_original_aspect_ratio=decrease,fps=30`,
      '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
      '-preset', 'veryfast', '-crf', crf, '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '64k', '-ac', '1',
      '-movflags', '+faststart',
      outputName,
    ])
    // Libera o input antes de ler o output — reduz o pico de memória no worker.
    await ffmpeg.deleteFile(inputName).catch(() => {})
    inputDeleted = true
    const data = await ffmpeg.readFile(outputName)
    const blob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' })
    if (blob.size >= file.size) {
      const reason = `output maior que original (${Math.round(blob.size / 1024 / 1024)}MB)`
      reportMediaTelemetry({ event: 'compress_fallback', reason, in_mb: Math.round(inMB), out_mb: Math.round(blob.size / 1024 / 1024) })
      onOutcome?.({ status: 'fallback', reason, inMB, outMB: blob.size / (1024 * 1024) })
      return file
    }
    const name = file.name.replace(/\.\w+$/, '') + '.mp4'
    onOutcome?.({ status: 'compressed', inMB, outMB: blob.size / (1024 * 1024) })
    return new File([blob], name, { type: 'video/mp4' })
  } catch (e) {
    const reason = `exec: ${e instanceof Error ? e.message : String(e)} | ${logTail.slice(-6).join(' ⏎ ')}`
    console.warn('[media] compressão de vídeo falhou, enviando original', e, logTail)
    reportMediaTelemetry({ event: 'compress_fallback', reason, in_mb: Math.round(inMB) })
    onOutcome?.({ status: 'fallback', reason, inMB })
    return file
  } finally {
    if (progressHandler) ffmpeg.off('progress', progressHandler)
    ffmpeg.off('log', logHandler)
    if (!inputDeleted) await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
  }
}

/** Valida tamanho e comprime (imagem ou vídeo) antes do upload. Lança MediaValidationError se reprovar. */
export async function prepareMediaForUpload(
  file: File,
  onProgress?: (ratio: number) => void,
  onOutcome?: (o: CompressOutcome) => void,
): Promise<File> {
  validateFileSize(file)
  if (file.type.startsWith('image/')) return compressImage(file)
  if (file.type.startsWith('video/')) return compressVideo(file, onProgress, onOutcome)
  return file
}
