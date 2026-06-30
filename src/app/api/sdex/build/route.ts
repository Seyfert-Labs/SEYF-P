import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildSdexPathPaymentXdr, isSdexQuote } from '@/lib/stellar/path-payment'

const bodySchema = z.object({
  quote: z.record(z.string(), z.unknown()),
  from: z.string().trim().min(1),
})

/** POST /api/sdex/build — XDR sin firmar para path payment en SDEX. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const { quote, from } = parsed.data
  if (!isSdexQuote(quote)) {
    return NextResponse.json({ error: 'Cotización SDEX inválida' }, { status: 400 })
  }

  try {
    const xdr = await buildSdexPathPaymentXdr(from, quote)
    return NextResponse.json({ xdr })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo construir la transacción'
    console.error('[sdex/build]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
