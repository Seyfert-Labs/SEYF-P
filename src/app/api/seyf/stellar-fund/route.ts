import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ensureFunded } from '@/lib/seyf/stellar-fund'
import { toErrorResponse } from '@/lib/seyf/api-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Friendbot puede reintentar + esperar propagación del ledger: damos margen.
export const maxDuration = 30

const bodySchema = z.object({
  publicKey: z.string().trim().min(56).max(56),
})

/**
 * POST /api/seyf/stellar-fund
 * Garantiza que la wallet Pollar (testnet) tenga XLM para pagar fees.
 * Idempotente: si la cuenta ya está fondeada, no vuelve a llamar a Friendbot.
 */
export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => null)) as unknown
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await ensureFunded(parsed.data.publicKey)
    return NextResponse.json(result)
  } catch (e) {
    return toErrorResponse(e, 'stellar-fund')
  }
}
