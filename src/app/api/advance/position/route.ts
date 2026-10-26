import { NextResponse } from 'next/server'
import { z } from 'zod'
import { advancePosition } from '@/lib/advance/contract'
import { accountSchema, badRequest, errorResponse, noStore } from '@/lib/advance/http'
import { rateLimitResponse } from '@/lib/seyf/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({ address: accountSchema })

/**
 * GET /api/advance/position?address=G…
 * Adelanto activo (o null), su estado de desbloqueo, parámetros y tesorería.
 */
export async function GET(request: Request) {
  const limited = await rateLimitResponse(request, 'advance/position', { limit: 120, windowSec: 60 })
  if (limited) return limited

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) return badRequest(parsed.error)

  try {
    return NextResponse.json(await advancePosition(parsed.data.address), { headers: noStore })
  } catch (e) {
    return errorResponse(e, 'advance/position')
  }
}
