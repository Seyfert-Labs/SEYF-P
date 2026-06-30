'use client'

import { useCallback, useRef, useState } from 'react'
import { usePollar } from '@pollar/react'

type FundResult =
  | { ok: true; funded: boolean; alreadyFunded: boolean; xlm: number | null }
  | { ok: false; error: string }

/**
 * Llama a /api/seyf/stellar-fund (Friendbot) para garantizar XLM de fees.
 * Función plana reusable fuera de React (p. ej. dentro de un callback que ya
 * tiene la publicKey). Idempotente.
 */
export async function fundStellarWallet(publicKey: string): Promise<FundResult> {
  if (!publicKey) return { ok: false, error: 'Wallet no conectada' }
  try {
    const res = await fetch('/api/seyf/stellar-fund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      funded?: boolean
      alreadyFunded?: boolean
      xlm?: number | null
      error?: { message_es?: string } | string
    }
    if (!res.ok) {
      const error =
        typeof data.error === 'string'
          ? data.error
          : data.error?.message_es ?? `HTTP ${res.status}`
      return { ok: false, error }
    }
    return {
      ok: true,
      funded: Boolean(data.funded),
      alreadyFunded: Boolean(data.alreadyFunded),
      xlm: data.xlm ?? null,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo fondear la wallet' }
  }
}

/**
 * Garantiza que la wallet Pollar conectada tenga XLM para pagar fees (testnet).
 * Llama a /api/seyf/stellar-fund (Friendbot) de forma idempotente: si la cuenta
 * ya existe on-chain con saldo, no hace nada. Debe correr ANTES de cualquier
 * operación que firme (trustline, depósito/retiro a bóvedas DeFindex).
 */
export function useEnsureStellarFunding() {
  const { walletAddress } = usePollar()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const ensureFunding = useCallback(async (): Promise<FundResult> => {
    if (busyRef.current) return { ok: false, error: 'Ya en progreso' }
    if (!walletAddress) return { ok: false, error: 'Wallet no conectada' }

    busyRef.current = true
    setBusy(true)
    try {
      return await fundStellarWallet(walletAddress)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [walletAddress])

  return { ensureFunding, busy }
}
