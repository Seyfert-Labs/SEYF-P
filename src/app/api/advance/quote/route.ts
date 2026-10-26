import { NextResponse } from 'next/server'
import { z } from 'zod'
import { quoteAdvance } from '@/lib/advance/contract'
import { accountSchema, badRequest, errorResponse, noStore, termDaysSchema, unitsSchema } from '@/lib/advance/http'
import { rateLimitResponse } from '@/lib/seyf/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  address: accountSchema,
  shares: unitsSchema,
  termDays: termDaysSchema,
})

/**
 * GET /api/advance/quote?address=G…&shares=…&termDays=…
 * Valor de las acciones y adelanto con los topes del contrato aplicados.
 */
export async function GET(request: Request) {
  const limited = await rateLimitResponse(request, 'advance/quote', { limit: 120, windowSec: 60 })
  if (limited) return limited

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) return badRequest(parsed.error)

  try {
    const { address, shares, termDays } = parsed.data
    return NextResponse.json(await quoteAdvance(address, shares, termDays), { headers: noStore })
  } catch (e) {
    return errorResponse(e, 'advance/quote')
  }
}
