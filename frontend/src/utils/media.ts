const MAX_IMAGE_MB = 25
const MAX_VIDEO_MB = 400
const IMAGE_COMPRESS_THRESHOLD_MB = 1.5
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
