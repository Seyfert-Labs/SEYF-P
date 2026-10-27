import { NextResponse } from 'next/server'
import { z } from 'zod'
import { settledEvents } from '@/lib/advance/events'
import { accountSchema, badRequest, errorResponse, noStore } from '@/lib/advance/http'
import { rateLimitResponse } from '@/lib/seyf/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({ address: accountSchema })

/**
 * GET /api/advance/history?address=G…
 * Liquidaciones (`settle`) del usuario que todavía guarda el RPC. Las demás
 * operaciones del adelanto las firma el usuario y salen de Horizon.
 */
export async function GET(request: Request) {
  const limited = await rateLimitResponse(request, 'advance/history', { limit: 60, windowSec: 60 })
  if (limited) return limited

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) return badRequest(parsed.error)

  try {
    return NextResponse.json({ settled: await settledEvents(parsed.data.address) }, { headers: noStore })
  } catch (e) {
    return errorResponse(e, 'advance/history')
  }
}
