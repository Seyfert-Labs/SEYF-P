import { NextResponse } from 'next/server'
import { z } from 'zod'
import { accountSchema, badRequest, errorResponse, noStore, unitsSchema } from '@/lib/advance/http'
import { buildVaultDeposit, buildVaultWithdraw } from '@/lib/advance/vault'
import { rateLimitResponse } from '@/lib/seyf/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('deposit'), address: accountSchema, amount: unitsSchema }),
  z.object({ action: z.literal('withdraw'), address: accountSchema, shares: unitsSchema }),
])

/**
 * POST /api/vault/build { action: 'deposit', address, amount } | { action: 'withdraw', address, shares }
 * Devuelve el XDR preparado y sin firmar; el usuario lo firma con Pollar y se
 * envía por /api/stellar/sponsor/submit.
 */
export async function POST(request: Request) {
  const limited = await rateLimitResponse(request, 'vault/build', { limit: 30, windowSec: 60 })
  if (limited) return limited

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error)

  try {
    const body = parsed.data
    const xdr =
      body.action === 'deposit'
        ? await buildVaultDeposit(body.address, body.amount)
        : await buildVaultWithdraw(body.address, body.shares)
    return NextResponse.json({ xdr }, { headers: noStore })
  } catch (e) {
    return errorResponse(e, 'vault/build')
  }
}
