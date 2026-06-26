import { NextResponse } from 'next/server'
import { z } from 'zod'
import { uploadEtherfuseKycDocuments } from '@/lib/etherfuse/kyc'
import { getEtherfuseOnboardingSession } from '@/lib/etherfuse/onboarding-session'
import { isValidStellarPublicKey, normalizeStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'
import { AppError, toErrorResponse } from '@/lib/seyf/api-error'
import { MAX_KYC_IMAGE_DATA_URL_CHARS } from '@/lib/seyf/kyc-upload-limits'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const DATA_URL_IMAGE_REGEX = /^data:image\/(jpeg|jpg|png);base64,[A-Za-z0-9+/=]+$/i

const imageSchema = z.object({
  label: z.string().trim().min(1),
  image: z
    .string()
    .trim()
    .min(32)
    .max(MAX_KYC_IMAGE_DATA_URL_CHARS)
    .regex(DATA_URL_IMAGE_REGEX),
})

const bodySchema = z.object({
  publicKey: z.string().trim().min(1).optional(),
  document: z
    .object({
      idFront: imageSchema,
      idBack: imageSchema.optional(),
    })
    .optional(),
  selfie: imageSchema.optional(),
})

/**
 * POST /api/seyf/kyc/documents
 * Reenvía documentos KYC (ID frente/reverso + selfie) a Etherfuse.
 */
export async function POST(req: Request) {
  try {
    const session = await getEtherfuseOnboardingSession()
    if (!session) {
      throw new AppError('validation_error', {
        statusCode: 401,
        retryable: false,
        message: 'No hay sesión de onboarding. Envía identidad primero.',
      })
    }

    const raw = (await req.json().catch(() => null)) as unknown
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      throw new AppError('validation_error', {
        statusCode: 400,
        retryable: false,
        message: `Invalid KYC documents payload: ${parsed.error.message}`,
      })
    }

    const requestedPublicKey = parsed.data.publicKey
      ? normalizeStellarPublicKey(parsed.data.publicKey)
      : session.publicKey
    if (!isValidStellarPublicKey(requestedPublicKey)) {
      throw new AppError('validation_error', {
        statusCode: 400,
        retryable: false,
        message: 'Invalid Stellar public key.',
      })
    }
    if (requestedPublicKey !== normalizeStellarPublicKey(session.publicKey)) {
      throw new AppError('validation_error', {
        statusCode: 409,
        retryable: false,
        message: 'La wallet no coincide con tu sesión KYC actual.',
      })
    }

    const statuses: string[] = []
    const messages: string[] = []

    if (parsed.data.document) {
      const images = [
        { label: parsed.data.document.idFront.label, image: parsed.data.document.idFront.image },
        ...(parsed.data.document.idBack
          ? [{ label: parsed.data.document.idBack.label, image: parsed.data.document.idBack.image }]
          : []),
      ]
      const docRes = await uploadEtherfuseKycDocuments({
        customerId: session.customerId,
        pubkey: requestedPublicKey,
        documentType: 'document',
        images,
      })
      statuses.push(docRes.status)
      if (docRes.message) messages.push(docRes.message)
    }

    if (parsed.data.selfie) {
      const selfieRes = await uploadEtherfuseKycDocuments({
        customerId: session.customerId,
        pubkey: requestedPublicKey,
        documentType: 'selfie',
        images: [{ label: parsed.data.selfie.label, image: parsed.data.selfie.image }],
      })
      statuses.push(selfieRes.status)
      if (selfieRes.message) messages.push(selfieRes.message)
    }

    if (statuses.length === 0) {
      throw new AppError('validation_error', {
        statusCode: 400,
        retryable: false,
        message: 'Debes subir al menos un documento o selfie.',
      })
    }

    const latestStatus = statuses[statuses.length - 1] ?? 'proposed'
    return NextResponse.json(
      {
        ok: true,
        status: latestStatus,
        message: messages.length > 0 ? messages.join(' | ') : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    if (process.env.NODE_ENV !== 'production' && e instanceof Error) {
      const base = toErrorResponse(e, 'kyc/documents')
      const body = (await base.json()) as { error?: unknown }
      return NextResponse.json(
        {
          ...(typeof body === 'object' && body ? body : {}),
          debug_message: e.message,
        },
        { status: base.status, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return toErrorResponse(e, 'kyc/documents')
  }
}
