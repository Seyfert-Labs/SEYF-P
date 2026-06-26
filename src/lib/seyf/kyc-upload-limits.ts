/**
 * Límite por archivo en el flujo KYC (Identidad).
 * Tres fotos en base64 en una sola petición superan con facilidad el tope ~4.5 MB
 * del cuerpo en Route Handlers en Vercel; el cliente envía INE y selfie en 2 peticiones
 * y mantiene cada archivo bajo este tope.
 */
export const MAX_KYC_IMAGE_FILE_BYTES = 1024 * 1024 // 1 MiB

/** Máx. longitud del data URL por imagen en validación zod (~1 MiB binario en base64 + prefijo). */
export const MAX_KYC_IMAGE_DATA_URL_CHARS = 1_450_000

export type KycDocumentsUploadStage = 'identification' | 'selfie'

/**
 * Mensajes claros para fallos de POST /api/seyf/kyc/documents (evita confundir 413 con “foto borrosa”).
 */
export function kycDocumentsFailureMessageEs(
  status: number,
  stage: KycDocumentsUploadStage,
  messageEs?: string | null,
): string {
  if (messageEs?.trim()) return messageEs.trim()
  if (status === 413) {
    if (stage === 'identification') {
      return 'Tus datos del formulario ya se guardaron. El servidor rechazó el envío porque las fotos del INE pesan demasiado en conjunto (límite técnico de la plataforma). Reduce cada imagen a menos de 1 MB (exporta en calidad media o comprime desde la galería) y vuelve a intentar solo el envío de fotos.'
    }
    return 'Tus datos del formulario ya se guardaron. El servidor rechazó la selfie porque el archivo pesa demasiado. Usa una foto de menos de 1 MB (calidad media o comprimir) y vuelve a intentar.'
  }
  if (status === 408 || status === 504) {
    return 'La subida tardó demasiado. Comprueba tu conexión e inténtalo de nuevo.'
  }
  if (status >= 500) {
    return 'El servidor no pudo recibir los documentos en este momento. Espera un minuto y reintenta.'
  }
  return 'No pudimos subir las fotos. Revisa tu conexión o inténtalo de nuevo; si usas fotos de alta resolución, baja el tamaño de archivo.'
}
