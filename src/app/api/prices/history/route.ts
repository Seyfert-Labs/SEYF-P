import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Mapa code → id de CoinGecko (fuente pública de histórico de precios en MXN). */
const CG_IDS: Record<string, string> = {
  XLM: 'stellar',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  BTC: 'bitcoin',
  ETH: 'ethereum',
}

/**
 * GET /api/prices/history?code=XLM&days=7
 * Serie real de precios en MXN (CoinGecko) para la gráfica del detalle del activo.
 * Activos sin mercado (p.ej. CETES) devuelven points vacío → la UI muestra su rendimiento.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = (url.searchParams.get('code') ?? '').toUpperCase()
  const days = Number(url.searchParams.get('days') ?? '7') || 7
  const id = CG_IDS[code]
  if (!id) return NextResponse.json({ points: [] }, { headers: { 'Cache-Control': 'no-store' } })

  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=mxn&days=${days}&interval=daily`,
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
    )
    if (!r.ok) return NextResponse.json({ points: [] }, { headers: { 'Cache-Control': 'no-store' } })
    const d = (await r.json()) as { prices?: unknown }
    const points = Array.isArray(d.prices)
      ? d.prices
          .map((p) => (Array.isArray(p) ? Number(p[1]) : NaN))
          .filter((n) => Number.isFinite(n) && n > 0)
      : []
    return NextResponse.json({ points }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ points: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
