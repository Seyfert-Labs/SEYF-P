import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildCloseAdvance, buildOpenAdvance } from '@/lib/advance/contract'
import { accountSchema, badRequest, errorResponse, noStore, termDaysSchema, unitsSchema } from '@/lib/advance/http'
import { rateLimitResponse } from '@/lib/seyf/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('open'),
    address: accountSchema,
    shares: unitsSchema,
    termDays: termDaysSchema,
    minAdvance: unitsSchema.optional(),
  }),
  z.object({ action: z.literal('repay'), address: accountSchema }),
  z.object({ action: z.literal('settle'), address: accountSchema }),
])

/**
 * POST /api/advance/build
 *   { action: 'open', address, shares, termDays, minAdvance? } | { action: 'repay' | 'settle', address }
 * Devuelve el XDR preparado y sin firmar; el usuario lo firma con Pollar y se
 * envía por /api/stellar/sponsor/submit.
 */
export async function POST(request: Request) {
  const limited = await rateLimitResponse(request, 'advance/build', { limit: 30, windowSec: 60 })
  if (limited) return limited

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error)

  try {
    const body = parsed.data
    const xdr =
      body.action === 'open'
        ? await buildOpenAdvance(body.address, body.shares, body.termDays, body.minAdvance)
        : await buildCloseAdvance(body.address, body.action)
    return NextResponse.json({ xdr }, { headers: noStore })
  } catch (e) {
    return errorResponse(e, 'advance/build')
  }
}
