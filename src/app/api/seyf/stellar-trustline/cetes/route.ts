import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildCetesTrustlineXdr, hasCetesTrustline } from '@/lib/seyf/stellar-trustline'
import { toErrorResponse } from '@/lib/seyf/api-error'

const bodySchema = z.object({
  publicKey: z.string().trim().min(56).max(56),
})

/**
 * POST /api/seyf/stellar-trustline/cetes
 * Returns an unsigned XDR to add a CETES trustline.
 * The client signs it via Pollar and submits.
 */
export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => null)) as unknown
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { publicKey } = parsed.data

    const alreadyHas = await hasCetesTrustline(publicKey)
    if (alreadyHas) {
      return NextResponse.json({ alreadyExists: true, xdr: null })
    }

    const xdr = await buildCetesTrustlineXdr(publicKey)
    return NextResponse.json({ alreadyExists: false, xdr })
  } catch (e) {
    return toErrorResponse(e, 'stellar-trustline/cetes')
  }
}
