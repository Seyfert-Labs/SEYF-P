import { NextResponse } from 'next/server'
import { z } from 'zod'
import { accountSchema, badRequest, errorResponse, noStore } from '@/lib/advance/http'
import { vaultPosition } from '@/lib/advance/vault'
import { rateLimitResponse } from '@/lib/seyf/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({ address: accountSchema })

/**
 * GET /api/vault/position?address=G…
 * Acciones del vault USDC en la cuenta y su valor, en unidades mínimas.
 */
export async function GET(request: Request) {
  const limited = await rateLimitResponse(request, 'vault/position', { limit: 120, windowSec: 60 })
  if (limited) return limited

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) return badRequest(parsed.error)

  try {
    return NextResponse.json(await vaultPosition(parsed.data.address), { headers: noStore })
  } catch (e) {
    return errorResponse(e, 'vault/position')
  }
}
