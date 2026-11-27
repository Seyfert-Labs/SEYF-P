'use client'

import type { CrossmintStellarClient } from '@/lib/wallet/crossmint-stellar'
import { seyfAuthHeaders } from '@/lib/stellar/auth-token'

export type SwapProvider = 'soroswap' | 'sdex'

export type SdexQuoteResult = {
  provider: SwapProvider
  from: string
  to: string
  amountIn: number
  amountOut: number
  slippageBps: number
}

async function postJson<T>(
  url: string,
  body: unknown,
  authed = false,
): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authed ? await seyfAuthHeaders() : {}),
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok && !data.error) {
    if (res.status === 404) {
      data.error = 'Cotización no disponible. Recarga la página (caché desactualizada).'
    } else if (res.status === 401) {
      data.error = 'Tu sesión expiró. Verifica tu wallet e intenta de nuevo.'
    } else {
      data.error = `Error del servidor (${res.status})`
    }
  }
  return { ok: res.ok, data }
}

/** Cotiza un cambio. El precio y el mínimo aceptable los fija el servidor. */
export async function quoteSdexSwap(from: string, to: string, amount: number): Promise<SdexQuoteResult> {
  const { ok, data } = await postJson<SdexQuoteResult>('/api/swap/quote', { from, to, amount })
  if (!ok) throw new Error(data.error || 'No se pudo cotizar el cambio')
  return data
}

/** Ejecuta el cambio: cotiza → arma XDR en el servidor → firma y envía con Crossmint. */
export async function executeSdexSwap(opts: {
  from: string
  to: string
  amount: number
  getClient: () => CrossmintStellarClient
  slippageBps?: number
}): Promise<{ txHash: string; amountOut: number; amountIn: number; provider: SwapProvider }> {
  const { from, to, amount, getClient, slippageBps } = opts
  const client = getClient()

  const quoteRes = await postJson<SdexQuoteResult>('/api/swap/quote', { from, to, amount, slippageBps })
  if (!quoteRes.ok) throw new Error(quoteRes.data.error || 'No se pudo cotizar el cambio')

  const buildRes = await postJson<{ xdr?: string; provider?: SwapProvider }>(
    '/api/swap/build',
    { from, to, amount, slippageBps },
    true,
  )
  if (!buildRes.ok || !buildRes.data.xdr) {
    throw new Error(buildRes.data.error || 'No se pudo construir la transacción')
  }

  const txHash = await client.signAndSubmitXdr(buildRes.data.xdr)

  return {
    txHash,
    amountOut: quoteRes.data.amountOut,
    amountIn: quoteRes.data.amountIn,
    provider: buildRes.data.provider ?? quoteRes.data.provider,
  }
}
