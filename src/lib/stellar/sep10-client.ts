'use client'

import type { CrossmintStellarClient } from '@/lib/wallet/crossmint-stellar'
import { peekSeyfAuthToken, setSeyfAuthInflight, setSeyfAuthToken } from '@/lib/stellar/auth-token'

export function sep10DeviceNotEnrolled(): boolean {
  return false
}

export async function ensureSeyfSession(
  client: CrossmintStellarClient,
  publicKey: string,
): Promise<string | null> {
  void client
  const existing = peekSeyfAuthToken()
  if (existing) return existing

  const promise = (async () => {
    try {
      const res = await fetch('/api/auth/sep10', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: publicKey, mode: 'crossmint' }),
      })
      const data = (await res.json().catch(() => ({}))) as { token?: string; expires_in?: number }
      if (res.ok && data.token) {
        setSeyfAuthToken(data.token, publicKey, data.expires_in ?? 86_400)
        return data.token
      }
      return null
    } catch {
      return null
    }
  })()

  setSeyfAuthInflight(promise)
  try {
    return await promise
  } finally {
    setSeyfAuthInflight(null)
  }
}
