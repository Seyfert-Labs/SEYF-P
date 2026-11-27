'use client'

import { useEffect, useRef } from 'react'
import { useSeyfStellarWallet } from '@/lib/seyf/use-seyf-stellar-wallet'
import { clearSeyfAuthToken, seyfAuthAccount } from '@/lib/stellar/auth-token'

/**
 * Sincroniza el estado de sesión de Crossmint con el almacenamiento local de cuenta activa.
 */
export default function SeyfAuthBridge() {
  const { authenticated, publicKey } = useSeyfStellarWallet()
  const wasAuthenticated = useRef(false)

  useEffect(() => {
    if (!authenticated || !publicKey) return
    if (seyfAuthAccount() && seyfAuthAccount() !== publicKey) {
      clearSeyfAuthToken()
    }
  }, [authenticated, publicKey])

  useEffect(() => {
    if (wasAuthenticated.current && !authenticated) {
      clearSeyfAuthToken()
    }
    wasAuthenticated.current = authenticated
  }, [authenticated])

  return null
}
