'use client'

import type { PollarClient } from '@pollar/core'
import { DEFINDEX_ASSET_SYMBOL } from '@/lib/defindex/vaults'
import { pollarSignXdr, waitForPollarSession } from '@/lib/pollar/client-api'

type DefindexSubmitResponse = {
  txHash?: string
  success?: boolean
  error?: string | { message_es?: string }
  debug_message?: string
}

function defindexErrorMessage(json: DefindexSubmitResponse, status: number): string {
  if (json.debug_message?.trim()) return json.debug_message.trim()
  if (typeof json.error === 'string' && json.error.trim()) return json.error.trim()
  if (json.error && typeof json.error === 'object' && json.error.message_es?.trim()) {
    return json.error.message_es.trim()
  }
  if (status === 502) return 'DeFindex no está disponible. Intenta en unos minutos.'
  return 'DeFindex rechazó el envío de la transacción'
}

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

async function submitSigned(signedXdr: string): Promise<string> {
  const submitRes = await fetch('/api/defindex/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedXdr }),
  })
  const submitJson = (await submitRes.json().catch(() => ({}))) as DefindexSubmitResponse

  if (!submitRes.ok || !submitJson.txHash) {
    throw new Error(defindexErrorMessage(submitJson, submitRes.status))
  }
  if (submitJson.success === false) {
    throw new Error(
      `La transacción no se confirmó en la red. Revisa saldo de ${DEFINDEX_ASSET_SYMBOL} en tu wallet Pollar.`,
    )
  }
  return submitJson.txHash
}

/**
 * Prepara fee → firma con Pollar → envía vía DeFindex (Soroban RPC).
 */
export async function signAndSubmitDefindexXdr(
  unsignedXdr: string,
  getClient: () => PollarClient,
): Promise<string> {
  const { publicKey, client } = await waitForPollarSession(getClient)
  const preparedXdr = await prepareXdr(unsignedXdr)
  const signedXdr = await pollarSignXdr(client, preparedXdr, publicKey)
  return submitSigned(signedXdr)
}
