'use client'

import type { CrossmintStellarClient } from '@/lib/wallet/crossmint-stellar'
import { seyfAuthHeaders } from '@/lib/stellar/auth-token'

type XdrResponse = { xdr?: string; exists?: boolean; error?: string }

async function postAuthed<T>(url: string, body?: unknown): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await seyfAuthHeaders()) },
    body: JSON.stringify(body ?? {}),
  })
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as T }
}

export async function ensureSponsoredAccount(
  client: CrossmintStellarClient,
  publicKey: string,
): Promise<{ created: boolean; txHash?: string }> {
  void client
  void publicKey
  return { created: false }
}

export async function ensureSponsoredTrustline(
  client: CrossmintStellarClient,
  publicKey: string,
  assetCode: string,
  assetIssuer: string,
): Promise<string> {
  void publicKey
  const { ok, data } = await postAuthed<XdrResponse>('/api/stellar/sponsor/trustline', {
    assetCode,
    assetIssuer,
  })
  if (!ok || !data.xdr) {
    throw new Error(data.error || 'No se pudo abrir la trustline')
  }
  return client.signAndSubmitXdr(data.xdr)
}
