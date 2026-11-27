'use client'

import { StellarWallet, type Wallet, type Chain } from '@crossmint/client-sdk-react-ui'

export interface CrossmintStellarClient {
  publicKey: string
  wallet: Wallet<Chain>
  stellarWallet: StellarWallet
  signAndSubmitXdr: (unsignedXdr: string, opts?: { contractId?: string }) => Promise<string>
}

/**
 * Construye un cliente tipado de Stellar sobre la Smart Wallet activa de Crossmint.
 */
export function createCrossmintStellarClient(wallet: Wallet<Chain>): CrossmintStellarClient {
  const stellarWallet = StellarWallet.from(wallet)

  return {
    publicKey: wallet.address,
    wallet,
    stellarWallet,
    async signAndSubmitXdr(unsignedXdr: string, opts?: { contractId?: string }): Promise<string> {
      const result = await stellarWallet.sendTransaction({
        transaction: unsignedXdr,
        contractId: opts?.contractId ?? "",
      })
      if (!result.hash) {
        throw new Error('Crossmint no devolvió hash de confirmación para la transacción.')
      }
      return result.hash
    },
  }
}
