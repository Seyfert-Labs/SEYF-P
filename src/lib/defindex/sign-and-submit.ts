'use client'

import type { CrossmintStellarClient } from '@/lib/wallet/crossmint-stellar'

async function prepareXdr(unsignedXdr: string): Promise<string> {
  const res = await fetch('/api/defindex/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xdr: unsignedXdr }),
  })
  const json = (await res.json().catch(() => ({}))) as { xdr?: string; error?: string }
  if (!res.ok || !json.xdr) {
    throw new Error(
      typeof json.error === 'string' ? json.error : 'No se pudo preparar la transacción Soroban',
    )
  }
  return json.xdr
}

/**
 * Prepara XDR Soroban → firma y envía vía Crossmint Smart Wallet.
 */
export async function signAndSubmitDefindexXdr(
  unsignedXdr: string,
  getClient: () => CrossmintStellarClient,
): Promise<string> {
  const client = getClient()
  const preparedXdr = await prepareXdr(unsignedXdr)
  return client.signAndSubmitXdr(preparedXdr)
}
