import { NextResponse } from 'next/server'
import { z } from 'zod'
import { soroswapQuote, SoroswapApiError } from '@/lib/soroswap/client'
import { soroswapAssetByCode, toStroops, fromStroops } from '@/lib/soroswap/assets'
import {
  isNoPathSoroswapError,
  isSdexSwapPair,
  quoteSdexPathPayment,
  type SdexSwapCode,
} from '@/lib/stellar/path-payment'

const bodySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  amount: z.number().positive(),
  slippageBps: z.number().int().positive().max(5000).optional(),
})

/**
 * POST /api/soroswap/quote { from, to, amount }
 * Cotiza vía Soroswap AMM; si no hay pool (testnet), cae a SDEX path payment para XLM↔USDC.
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
      { error: `Par no disponible (${from}→${to}).` },
      { status: 422 },
    )
  }

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
      provider: 'soroswap' as const,
      from: assetIn.code,
      to: assetOut.code,
      amountIn: amount,
      amountOut: fromStroops(quote.amountOut),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo cotizar el swap'

    // Fallback SDEX: en testnet no hay pools AMM XLM/USDC, pero el order book clásico sí tiene liquidez.
    if (isSdexSwapPair(from, to) && isNoPathSoroswapError(message)) {
      try {
        const sdex = await quoteSdexPathPayment(
          from.toUpperCase() as SdexSwapCode,
          to.toUpperCase() as SdexSwapCode,
          amount,
          slippageBps ?? 50,
        )
        console.info(`[soroswap/quote] Soroswap sin ruta → SDEX ${from}→${to} out=${sdex.amountOut}`)
        return NextResponse.json({
          quote: sdex.quote,
          provider: 'sdex' as const,
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          amountIn: amount,
          amountOut: sdex.amountOut,
        })
      } catch (sdexErr) {
        const sdexMsg = sdexErr instanceof Error ? sdexErr.message : 'SDEX sin ruta'
        console.error(`[soroswap/quote] SDEX fallback falló:`, sdexMsg)
        return NextResponse.json(
          {
            error:
              'No hay liquidez para este cambio en testnet. Prueba XLM↔USDC con un monto menor (ej. 1–10 XLM) o intenta más tarde.',
          },
          { status: 422 },
        )
      }
    }

    const status = e instanceof SoroswapApiError ? (e.status >= 400 ? e.status : 502) : 502
    console.error(`[soroswap/quote] ${route}`, message)
    return NextResponse.json({ error: `[${route}] ${message}` }, { status })
  }
}
