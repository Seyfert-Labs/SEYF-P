'use client'

import { useCallback, useRef, useState } from 'react'
import { usePollar } from '@pollar/react'

type TrustlineResult =
  | { ok: true; alreadyExisted: boolean }
  | { ok: false; error: string }

/**
 * Hook that ensures the connected Pollar wallet has a CETES trustline.
 * Builds unsigned XDR on the server, signs + submits via Pollar.
 */
export function useEnsureCetesTrustline() {
  const { walletAddress, signAndSubmitTx } = usePollar()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const ensure = useCallback(async (): Promise<TrustlineResult> => {
    if (busyRef.current) return { ok: false, error: 'Ya en progreso' }
    if (!walletAddress) return { ok: false, error: 'Wallet no conectada' }

    busyRef.current = true
    setBusy(true)
    try {
      const res = await fetch('/api/seyf/stellar-trustline/cetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: walletAddress }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        alreadyExists?: boolean
        xdr?: string | null
        error?: string
      }

      if (!res.ok) {
        return { ok: false, error: data.error ?? `HTTP ${res.status}` }
      }

      if (data.alreadyExists) {
        return { ok: true, alreadyExisted: true }
      }

      if (!data.xdr) {
        return { ok: false, error: 'No se pudo construir la transaccion de trustline' }
      }

      await signAndSubmitTx(data.xdr)
      return { ok: true, alreadyExisted: false }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Error al agregar trustline' }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [walletAddress, signAndSubmitTx])

  return { ensure, ensureTrustline: ensure, busy }
}
