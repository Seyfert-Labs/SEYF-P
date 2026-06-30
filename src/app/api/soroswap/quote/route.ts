import { NextResponse } from 'next/server'
import { z } from 'zod'
import { soroswapQuote, SoroswapApiError } from '@/lib/soroswap/client'
import { soroswapAssetByCode, toStroops, fromStroops } from '@/lib/soroswap/assets'

const bodySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  amount: z.number().positive(),
  slippageBps: z.number().int().positive().max(5000).optional(),
})

/**
 * POST /api/soroswap/quote { from, to, amount }
 * Resuelve los códigos (XLM/USDC/…) a direcciones de contrato y cotiza el swap.
 * Devuelve la cotización opaca (para /build) + el monto de salida en humano.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const { from, to, amount, slippageBps } = parsed.data

  const assetIn = soroswapAssetByCode(from)
  const assetOut = soroswapAssetByCode(to)
  if (!assetIn?.address || !assetOut?.address) {
    return NextResponse.json(
      { error: `Par no disponible en Soroswap (${from}→${to}). Falta liquidez o configuración del token.` },
      { status: 422 },
    )
  }

  // Diagnóstico: muestra qué direcciones resolvió el build (detecta env overrides).
  const route = `${assetIn.code}(${assetIn.address.slice(0, 6)}…)→${assetOut.code}(${assetOut.address.slice(0, 6)}…)`

  try {
    const quote = await soroswapQuote({
      assetIn: assetIn.address,
      assetOut: assetOut.address,
      amount: toStroops(amount),
      slippageBps,
    })
    return NextResponse.json({
      quote,
      from: assetIn.code,
      to: assetOut.code,
      amountIn: amount,
      amountOut: fromStroops(quote.amountOut),
    })
  } catch (e) {
    const status = e instanceof SoroswapApiError ? (e.status >= 400 ? e.status : 502) : 502
    const message = e instanceof Error ? e.message : 'No se pudo cotizar el swap'
    console.error(`[soroswap/quote] ${route} assetOut=${assetOut.address}`, message)
    return NextResponse.json({ error: `[${route}] ${message}` }, { status })
  }
}
