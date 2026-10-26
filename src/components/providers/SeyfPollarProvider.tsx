'use client'

import { ReactNode, useState } from 'react'
import { PollarProvider } from '@pollar/react'
import { PollarClient, type PollarClientConfig } from '@pollar/core'
import '@pollar/react/styles.css'
import { stellarWalletNetworkFromEnv } from '@/lib/seyf/stellar-wallet-network'
import SeyfAuthBridge from './SeyfAuthBridge'

const apiKey =
  process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_POLLAR_API_KEY?.trim() ||
  ''

const config: PollarClientConfig = { apiKey, stellarNetwork: stellarWalletNetworkFromEnv() }

/**
 * Un solo PollarClient por pestaña. Si el provider recibe un objeto de config,
 * Pollar crea un cliente nuevo cada vez que el provider se monta; varios clientes
 * con la misma llave rotan el refresh token cada uno por su lado y Pollar cierra
 * la sesión de todos ("Another PollarClient is already active").
 */
let browserClient: PollarClient | null = null
function pollarClient(): PollarClient | PollarClientConfig {
  if (typeof window === 'undefined') return config
  browserClient ??= new PollarClient(config)
  return browserClient
}

export default function SeyfPollarProvider({ children }: { children: ReactNode }) {
  const [client] = useState(pollarClient)

  if (typeof window !== 'undefined' && !apiKey) {
    console.warn('[SEYF] Falta NEXT_PUBLIC_POLLAR_API_KEY para wallet Stellar (CETES).')
  }

  return (
    <PollarProvider client={client}>
      <SeyfAuthBridge />
      {children}
    </PollarProvider>
  )
}
