/**
 * USDC de Circle según la red activa. Cliente y servidor.
 *
 * Mainnet: emisor de Circle (verificado con stellar-raven, 2026-10-25).
 * Testnet: hay varios emisores de USDC que no comparten liquidez, así que cada
 * módulo pasa el suyo como `testnetIssuer` (SDEX o DeFindex).
 * Override: `NEXT_PUBLIC_STELLAR_USDC_ISSUER` (cliente y servidor) o
 * `STELLAR_USDC_ISSUER` (solo servidor).
 */

import { Asset } from '@stellar/stellar-sdk'
import { stellarNetworkPassphrase, stellarWalletNetworkFromEnv } from '@/lib/stellar/network'

export const USDC_ISSUER_MAINNET = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
/** USDC de Circle en testnet (liquidez en SDEX). */
export const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

export function usdcIssuer(testnetIssuer: string = USDC_ISSUER_TESTNET): string {
  const override =
    process.env.NEXT_PUBLIC_STELLAR_USDC_ISSUER?.trim() || process.env.STELLAR_USDC_ISSUER?.trim()
  if (override) return override
  return stellarWalletNetworkFromEnv() === 'mainnet' ? USDC_ISSUER_MAINNET : testnetIssuer
}

export function usdcAsset(testnetIssuer?: string): Asset {
  return new Asset('USDC', usdcIssuer(testnetIssuer))
}

/** Contrato SAC del USDC (en mainnet: CCW67TSZ…MI75). */
export function usdcSacContractId(testnetIssuer?: string): string {
  return usdcAsset(testnetIssuer).contractId(stellarNetworkPassphrase())
}
