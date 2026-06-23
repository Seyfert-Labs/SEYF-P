import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDefindexSDK, defindexNetwork } from '@/lib/defindex/client'
import { toErrorResponse } from '@/lib/reyf/api-error'

const bodySchema = z.object({
  signedXdr: z.string().trim().min(1),
})

/**
 * POST /api/defindex/submit { signedXdr }
 * Reenvía a la red el XDR ya firmado por Pollar y devuelve el hash/estado.
 */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const sdk = getDefindexSDK()
    const res = await sdk.sendTransaction(parsed.data.signedXdr, defindexNetwork())
    return NextResponse.json({
      txHash: res.txHash,
      success: res.success,
      ledger: res.ledger,
    })
  } catch (e) {
    return toErrorResponse(e, 'defindex/submit')
  }
}
