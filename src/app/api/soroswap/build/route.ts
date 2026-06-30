import { NextResponse } from 'next/server'
import { z } from 'zod'
import { soroswapBuild, SoroswapApiError } from '@/lib/soroswap/client'
import { buildSdexPathPaymentXdr, isSdexQuote } from '@/lib/stellar/path-payment'

const bodySchema = z.object({
  quote: z.record(z.string(), z.unknown()),
  from: z.string().trim().min(1),
})

/**
 * POST /api/soroswap/build { quote, from }
 * Construye XDR sin firmar (Soroswap AMM o SDEX path payment).
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const { quote, from } = parsed.data

  try {
    if (isSdexQuote(quote)) {
      const xdr = await buildSdexPathPaymentXdr(from, quote)
      return NextResponse.json({ xdr, provider: 'sdex' as const })
    }

    const { xdr } = await soroswapBuild(quote, from)
    if (!xdr) {
      return NextResponse.json({ error: 'Soroswap no devolvió XDR' }, { status: 502 })
    }
    return NextResponse.json({ xdr, provider: 'soroswap' as const })
  } catch (e) {
    const status = e instanceof SoroswapApiError ? (e.status >= 400 ? e.status : 502) : 502
    const message = e instanceof Error ? e.message : 'No se pudo construir la transacción'
    console.error('[soroswap/build]', message)
    return NextResponse.json({ error: message }, { status })
  }
}
