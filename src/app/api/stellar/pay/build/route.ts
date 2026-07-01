import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildStellarPaymentXdr } from '@/lib/stellar/path-payment'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  asset: z.enum(['XLM', 'USDC']),
  amount: z.string().trim().min(1),
})

/** POST /api/stellar/pay/build — XDR sin firmar para un pago Stellar entre cuentas SEYF. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  try {
    const xdr = await buildStellarPaymentXdr(parsed.data)
    return NextResponse.json({ xdr })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo construir la transacción'
    console.error('[stellar/pay/build]', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
