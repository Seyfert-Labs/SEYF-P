'use client'

import type { PollarClient } from '@pollar/core'
import { pollarSignXdr, waitForPollarSession } from '@/lib/pollar/client-api'

export type SeyfPayAsset = 'XLM' | 'USDC'

/**
 * Transferencia entre cuentas SEYF por el riel Stellar, firmada por Pollar:
 * espera sesión → construye el pago (server) → firma con Pollar → envía a Horizon.
 */
export async function sendStellarToSeyf(opts: {
  to: string
  asset: SeyfPayAsset
  amount: number
  getClient: () => PollarClient
}): Promise<{ txHash: string }> {
  const { to, asset, amount, getClient } = opts
  const { publicKey, client } = await waitForPollarSession(getClient)

  const buildRes = await fetch('/api/stellar/pay/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: publicKey, to, asset, amount: String(amount) }),
  })
  const buildData = (await buildRes.json().catch(() => ({}))) as { xdr?: string; error?: string }
  if (!buildRes.ok || !buildData.xdr) {
    throw new Error(buildData.error || 'No se pudo construir la transacción')
  }

  const signedXdr = await pollarSignXdr(client, buildData.xdr, publicKey)

  // Reutiliza el submit genérico de XDR firmado (mismo que SDEX).
  const sendRes = await fetch('/api/sdex/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedXdr }),
  })
  const sendData = (await sendRes.json().catch(() => ({}))) as { txHash?: string; error?: string }
  if (!sendRes.ok || !sendData.txHash) {
    throw new Error(sendData.error || 'La transacción no se confirmó en la red')
  }
  return { txHash: sendData.txHash }
}
