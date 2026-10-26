'use client'

import { useEffect, useRef } from 'react'
import { usePollar } from '@pollar/react'
import { ensureSeyfSession } from '@/lib/stellar/sep10-client'
import { clearSeyfAuthToken, seyfAuthAccount } from '@/lib/stellar/auth-token'

/**
 * Abre la sesión SEP-10 en cuanto la wallet Stellar queda autenticada.
 *
 * Va montado dentro del PollarProvider y no pinta nada: solo garantiza que
 * exista un token antes de que las pantallas empiecen a pedir datos a
 * /api/db/*, que ahora exigen identidad probada.
 */
export default function SeyfAuthBridge() {
  const { isAuthenticated, wallet, getClient } = usePollar()
  const walletAddress = wallet?.address ?? null
  const mintedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !walletAddress) return
    // Si la sesión guardada es de otra cuenta, no sirve.
    if (seyfAuthAccount() && seyfAuthAccount() !== walletAddress) clearSeyfAuthToken()
    if (mintedFor.current === walletAddress) return
    mintedFor.current = walletAddress

    let cancelled = false
    void (async () => {
      try {
        const client = getClient()
        const token = await ensureSeyfSession(client, walletAddress)
        // Permite reintentar en el siguiente render si la firma falló.
        if (!token && !cancelled) mintedFor.current = null
      } catch {
        if (!cancelled) mintedFor.current = null
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, walletAddress, getClient])

  // Solo al cerrar sesión (true → false). Al recargar, Pollar arranca en false
  // mientras reanuda la sesión: borrar ahí obligaba a firmar de nuevo cada recarga.
  const wasAuthenticated = useRef(false)
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      clearSeyfAuthToken()
      mintedFor.current = null
    }
    wasAuthenticated.current = isAuthenticated
  }, [isAuthenticated])

  return null
}
