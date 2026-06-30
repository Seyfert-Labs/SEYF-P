import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sdexAssetByCode } from '@/lib/sdex/assets'
import { isSdexSwapPair, quoteSdexPathPayment, type SdexSwapCode } from '@/lib/stellar/path-payment'

const bodySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  amount: z.number().positive(),
  slippageBps: z.number().int().positive().max(5000).optional(),
})

/** POST /api/sdex/quote — cotiza XLM↔USDC vía SDEX (Horizon path payment). */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const { from, to, amount, slippageBps } = parsed.data

  if (!sdexAssetByCode(from) || !sdexAssetByCode(to)) {
    return NextResponse.json({ error: `Activo no soportado (${from}→${to}).` }, { status: 422 })
  }
  if (!isSdexSwapPair(from, to)) {
    return NextResponse.json(
      { error: 'Por ahora solo puedes convertir entre XLM y USDC.' },
      { status: 422 },
    )
  }

  try {
    const sdex = await quoteSdexPathPayment(
      from.toUpperCase() as SdexSwapCode,
      to.toUpperCase() as SdexSwapCode,
      amount,
      slippageBps ?? 50,
    )
    return NextResponse.json({
      quote: sdex.quote,
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      amountIn: amount,
      amountOut: sdex.amountOut,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo cotizar el cambio'
    console.error(`[sdex/quote] ${from}→${to}`, message)
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
