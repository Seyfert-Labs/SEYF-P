'use client'

import { ReactNode } from 'react'
import {
  CrossmintProvider,
  CrossmintAuthProvider,
  CrossmintWalletProvider,
} from '@crossmint/client-sdk-react-ui'
import SeyfAuthBridge from './SeyfAuthBridge'

const apiKey = process.env.NEXT_PUBLIC_CROSSMINT_API_KEY?.trim() || ''
const hasValidKey = apiKey.startsWith('ck_') || apiKey.startsWith('sk_')

export default function SeyfCrossmintProvider({ children }: { children: ReactNode }) {
  if (!hasValidKey) {
    if (typeof window !== 'undefined') {
      console.warn('[SEYF] Falta NEXT_PUBLIC_CROSSMINT_API_KEY válida (ck_... o sk_...).')
    }
    return <>{children}</>
  }

  return (
    <CrossmintProvider apiKey={apiKey}>
      <CrossmintAuthProvider loginMethods={['email', 'google']}>
        <CrossmintWalletProvider
          createOnLogin={{
            chain: 'stellar',
            recoveryMethods: [{ type: 'email' }],
          }}
        >
          <SeyfAuthBridge />
          {children}
        </CrossmintWalletProvider>
      </CrossmintAuthProvider>
    </CrossmintProvider>
  )
}
