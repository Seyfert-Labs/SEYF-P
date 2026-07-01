'use client'

import type { PollarClient } from '@pollar/core'
import { pollarSignXdr, waitForPollarSession } from '@/lib/pollar/client-api'

export type SdexQuoteResult = {
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
  if (!res.ok && !data.error) {
    if (res.status === 404) {
      data.error = 'Cotización no disponible. Recarga la página (caché desactualizada).'
    } else {
      data.error = `Error del servidor (${res.status})`
    }
  }
  return { ok: res.ok, data }
}

/** Cotiza un cambio XLM↔USDC en el SDEX de Stellar. */
export async function quoteSdexSwap(from: string, to: string, amount: number): Promise<SdexQuoteResult> {
  const { ok, data } = await postJson<SdexQuoteResult>('/api/sdex/quote', { from, to, amount })
  if (!ok) throw new Error(data.error || 'No se pudo cotizar el cambio')
  return data
}

/** Ejecuta el cambio: cotiza → construye XDR → firma Pollar → envía a Horizon. */
export async function executeSdexSwap(opts: {
  from: string
  to: string
  amount: number
  getClient: () => PollarClient
  slippageBps?: number
}): Promise<{ txHash: string; amountOut: number; amountIn: number }> {
  const { from, to, amount, getClient, slippageBps } = opts
  const { publicKey, client } = await waitForPollarSession(getClient)

  const quoteRes = await postJson<SdexQuoteResult>('/api/sdex/quote', { from, to, amount, slippageBps })
  if (!quoteRes.ok) throw new Error(quoteRes.data.error || 'No se pudo cotizar el cambio')

  const buildRes = await postJson<{ xdr?: string }>('/api/sdex/build', {
    quote: quoteRes.data.quote,
    from: publicKey,
  })
  if (!buildRes.ok || !buildRes.data.xdr) {
    throw new Error(buildRes.data.error || 'No se pudo construir la transacción')
  }

  const signedXdr = await pollarSignXdr(client, buildRes.data.xdr, publicKey)

  const sendRes = await postJson<{ txHash?: string }>('/api/sdex/send', { signedXdr })
  if (!sendRes.ok || !sendRes.data.txHash) {
    throw new Error(sendRes.data.error || 'La transacción no se confirmó en la red')
  }

  return {
    txHash: sendRes.data.txHash,
    amountOut: quoteRes.data.amountOut,
    amountIn: quoteRes.data.amountIn,
  }
}
