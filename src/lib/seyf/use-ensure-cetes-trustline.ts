'use client'

import { useCallback, useRef, useState } from 'react'
import { useSeyfStellarWallet } from '@/lib/seyf/use-seyf-stellar-wallet'

type TrustlineResult =
  | { ok: true; alreadyExisted: boolean }
  | { ok: false; error: string }

export function useEnsureCetesTrustline() {
  const { publicKey, getClient } = useSeyfStellarWallet()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const ensure = useCallback(async (): Promise<TrustlineResult> => {
    if (busyRef.current) return { ok: false, error: 'Ya en progreso' }
    if (!publicKey) return { ok: false, error: 'Wallet no conectada' }

    busyRef.current = true
    setBusy(true)
    try {
      const res = await fetch('/api/seyf/stellar-trustline/cetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        alreadyExists?: boolean
        xdr?: string | null
        error?: string
      }

      if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` }
      if (data.alreadyExists) return { ok: true, alreadyExisted: true }
      if (!data.xdr) return { ok: false, error: 'No se pudo construir la transacción de trustline' }

      const client = getClient()
      await client.signAndSubmitXdr(data.xdr)
      return { ok: true, alreadyExisted: false }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Error al agregar trustline' }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [publicKey, getClient])

  return { ensure, ensureTrustline: ensure, busy }
}
