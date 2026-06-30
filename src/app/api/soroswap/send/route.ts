import { NextResponse } from 'next/server'
import { z } from 'zod'
import { soroswapSend, SoroswapApiError } from '@/lib/soroswap/client'
import { inferSwapProvider, submitSignedStellarXdr } from '@/lib/stellar/path-payment'

const bodySchema = z.object({
  signedXdr: z.string().trim().min(1),
  provider: z.enum(['soroswap', 'sdex']).optional(),
  quote: z.record(z.string(), z.unknown()).optional(),
})

function extractHash(res: Record<string, unknown>): string | null {
  const h =
    (res.txHash as string) ||
    (res.hash as string) ||
    ((res.transaction as { hash?: string } | undefined)?.hash ?? '')
  return typeof h === 'string' && h.trim() ? h.trim() : null
}

/**
 * POST /api/soroswap/send { signedXdr, provider?, quote? }
 * Envía el XDR firmado (Soroswap relay o Horizon directo para SDEX).
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const { signedXdr, provider, quote } = parsed.data
  const resolved = inferSwapProvider(provider, quote)

  try {
    if (resolved === 'sdex') {
      const txHash = await submitSignedStellarXdr(signedXdr)
      return NextResponse.json({ txHash, success: true })
    }

    const res = await soroswapSend(signedXdr)
    const txHash = extractHash(res)
    if (!txHash) {
      console.error('[soroswap/send] respuesta sin hash:', JSON.stringify(res).slice(0, 300))
      return NextResponse.json({ error: 'La transacción no se confirmó en la red', raw: res }, { status: 502 })
    }
    return NextResponse.json({ txHash, success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo enviar la transacción'
    const status = e instanceof SoroswapApiError ? (e.status >= 400 ? e.status : 502) : 400
    console.error(`[soroswap/send] provider=${resolved}`, message)
    return NextResponse.json({ error: message }, { status })
  }
}
