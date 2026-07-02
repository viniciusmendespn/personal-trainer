const MAX_IMAGE_MB = 25
const MAX_VIDEO_MB = 400
const IMAGE_COMPRESS_THRESHOLD_MB = 1
const IMAGE_MAX_DIMENSION = 1600
const IMAGE_QUALITY = 0.8

/** Cache-Control aplicado no upload (presigned PUT). As chaves de mídia são content-addressed
 * por uuid, então o conteúdo é imutável. Este header PRECISA ser idêntico ao assinado no
 * backend (media_service.gerar_presigned_upload_url*), senão a assinatura do PUT falha. */
export const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable'

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

/** Lê só as dimensões da imagem (decode lazy via <img>, não aloca o raster full-res). */
async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = document.createElement('img')
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode falhou'))
      img.src = url
    })
    return { width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Redesenha em canvas e reexporta como JPEG. Não mexe em arquivos já pequenos.
 * Decodifica JÁ reduzido (resizeWidth/Height do createImageBitmap) para NUNCA materializar o
 * bitmap full-res na memória — fotos de câmera Android de 48–108MP causavam OOM e crash/reload
 * da PWA. Ver ARCHITECTURE / plano issue 3. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= IMAGE_COMPRESS_THRESHOLD_MB * 1024 * 1024) {
    return file
  }
  try {
    const { width, height } = await readImageSize(file)
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const bitmap = await createImageBitmap(file, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return file
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/**
 * Prepara a mídia para upload. IMAGEM é comprimida no cliente (canvas, rápido). VÍDEO sobe
 * CRU — a compressão acontece no backend (transcode server-side disparado por evento S3), pra
 * o upload ser rápido e não travar o celular. Ver backend/app/transcode.py.
 * Lança MediaValidationError se o arquivo exceder o limite de tamanho.
 */
export async function prepareMediaForUpload(file: File): Promise<File> {
  validateFileSize(file)
  if (file.type.startsWith('image/')) return compressImage(file)
  return file
}
