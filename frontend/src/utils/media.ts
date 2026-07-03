const MAX_IMAGE_MB = 25
const MAX_VIDEO_MB = 400
const IMAGE_COMPRESS_THRESHOLD_MB = 1
const IMAGE_QUALITY = 0.8
// Limite de área do canvas (iOS Safari corta ~16.7M px; abaixo disso é seguro em todo lugar).
const MAX_CANVAS_AREA = 16_000_000

/** Dimensão-alvo escolhida conforme a RAM do aparelho — celulares fracos ganham alvo menor
 * para reduzir o pico de memória no decode (foto de câmera de 48–108MP causava OOM/crash). */
function targetMaxDimension(): number {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof mem === 'number' && mem > 0 && mem <= 2) return 1280
  return 1600
}

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

/** Redesenha em canvas e reexporta como JPEG. Não mexe em arquivos já pequenos.
 *
 * Faz UM ÚNICO decode via <img> (`img.decode()`) e desenha já reduzido com `drawImage(img,…,w,h)`.
 * Evita o decode duplo do modelo antigo (readImageSize + createImageBitmap, que mantinha ~2× o
 * raster full-res vivo) e o fato de o `createImageBitmap({resizeWidth})` do Chromium escalar só
 * DEPOIS de decodificar em resolução cheia — o que estourava a memória e reiniciava a PWA com
 * fotos de câmera Android de 48–108MP. O caminho <img> também deixa o Blink subamostrar imagens
 * muito grandes no próprio decode, reduzindo o pico. Ver plano issue 3. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= IMAGE_COMPRESS_THRESHOLD_MB * 1024 * 1024) {
    return file
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  try {
    img.src = url
    await img.decode()
    const width = img.naturalWidth
    const height = img.naturalHeight
    if (!width || !height) return file

    // Escala pra caber na dimensão-alvo E no limite de área do canvas.
    let scale = Math.min(1, targetMaxDimension() / Math.max(width, height))
    if (width * height * scale * scale > MAX_CANVAS_AREA) {
      scale = Math.sqrt(MAX_CANVAS_AREA / (width * height))
    }
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY))
    // Libera o canvas imediatamente (não segura o raster).
    canvas.width = 0
    canvas.height = 0
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  } finally {
    img.src = ''
    URL.revokeObjectURL(url)
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
