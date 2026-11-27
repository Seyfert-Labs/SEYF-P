'use client'

import type { CrossmintStellarClient } from '@/lib/wallet/crossmint-stellar'

export type SeyfPayAsset = 'XLM' | 'USDC'

/**
 * Transferencia entre cuentas SEYF por el riel Stellar, ejecutada con Crossmint.
 */
export async function sendStellarToSeyf(opts: {
  to: string
  asset: SeyfPayAsset
  amount: number
  getClient: () => CrossmintStellarClient
}): Promise<{ txHash: string }> {
  const { to, asset, amount, getClient } = opts
  const client = getClient()

  const buildRes = await fetch('/api/stellar/pay/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: client.publicKey, to, asset, amount: String(amount) }),
  })
  const buildData = (await buildRes.json().catch(() => ({}))) as { xdr?: string; error?: string }
  if (!buildRes.ok || !buildData.xdr) {
    throw new Error(buildData.error || 'No se pudo construir la transacción')
  }

  const txHash = await client.signAndSubmitXdr(buildData.xdr)
  return { txHash }
}
