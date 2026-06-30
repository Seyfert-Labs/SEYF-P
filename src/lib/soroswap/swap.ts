'use client'

import type { PollarClient } from '@pollar/core'
import { pollarSignXdr, waitForPollarSession } from '@/lib/pollar/client-api'

// Cliente del navegador para el swap Soroswap. Nunca habla con api.soroswap.finance
// directo (la API key es server-side); pasa por /api/soroswap/*. La firma del XDR
// la hace la wallet Pollar, igual que los depósitos DeFindex.

export type SoroswapQuoteResult = {
  quote: Record<string, unknown>
  from: string
  to: string
  amountIn: number
  amountOut: number
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  return { ok: res.ok, data }
}

/** Cotiza un swap (para mostrar en vivo el monto estimado de salida). */
export async function quoteSoroswap(
  from: string,
  to: string,
  amount: number,
): Promise<SoroswapQuoteResult> {
  const { ok, data } = await postJson<SoroswapQuoteResult>('/api/soroswap/quote', { from, to, amount })
  if (!ok) throw new Error(data.error || 'No se pudo cotizar el swap')
  return data
}

/**
 * Ejecuta un swap completo: re-cotiza fresco → construye XDR → firma con Pollar →
 * envía. Devuelve el hash y el monto recibido. La cotización se rehace al momento
 * de ejecutar para no firmar contra un precio viejo de la UI.
 */
export async function executeSoroswapSwap(opts: {
  from: string
  to: string
  amount: number
  getClient: () => PollarClient
  slippageBps?: number
}): Promise<{ txHash: string; amountOut: number; amountIn: number }> {
  const { from, to, amount, getClient, slippageBps } = opts

  // 1. Asegura sesión Pollar lista (token + wallet) antes de firmar.
  const { publicKey, client } = await waitForPollarSession(getClient)

  // 2. Cotización fresca.
  const quoteRes = await postJson<SoroswapQuoteResult>('/api/soroswap/quote', {
    from,
    to,
    amount,
    slippageBps,
  })
  if (!quoteRes.ok) throw new Error(quoteRes.data.error || 'No se pudo cotizar el swap')

  // 3. Construye el XDR (sin firmar) para esta wallet.
  const buildRes = await postJson<{ xdr?: string }>('/api/soroswap/build', {
    quote: quoteRes.data.quote,
    from: publicKey,
  })
  if (!buildRes.ok || !buildRes.data.xdr) {
    throw new Error(buildRes.data.error || 'No se pudo construir la transacción del swap')
  }

  // 4. Firma con Pollar (preserva el footprint Soroban del XDR de Soroswap).
  const signedXdr = await pollarSignXdr(client, buildRes.data.xdr, publicKey)

  // 5. Envía a la red vía Soroswap.
  const sendRes = await postJson<{ txHash?: string }>('/api/soroswap/send', { signedXdr })
  if (!sendRes.ok || !sendRes.data.txHash) {
    throw new Error(sendRes.data.error || 'La transacción no se confirmó en la red')
  }

  return {
    txHash: sendRes.data.txHash,
    amountOut: quoteRes.data.amountOut,
    amountIn: quoteRes.data.amountIn,
  }
}
