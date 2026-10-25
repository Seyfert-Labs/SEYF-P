'use client'

/**
 * Cliente de las rutas que usa /retiro.
 *
 * Todas las acciones siguen el mismo camino: el servidor arma el XDR, el
 * usuario lo firma con Pollar y nuestro sponsor lo envía en fee-bump. El
 * servidor nunca tiene fondos ni llaves del usuario.
 */

import type { PollarClient } from '@pollar/core'
import { pollarSignXdr } from '@/lib/pollar/client-api'
import { seyfAuthHeaders } from '@/lib/stellar/auth-token'
import { horizonUrl } from '@/lib/stellar/network'

export type VaultPosition = {
  shares: string
  value: string
  asset?: string
  decimals?: number | string
}

export type AdvanceQuote = { value: string; advance: string }

/** Montos en unidades mínimas; fechas en segundos Unix (forma de `src/lib/advance/contract.ts`). */
export type AdvancePositionRow = {
  shares: string
  valueAtOpen: string
  advance: string
  openedAt: number
  expectedUnlockAt: number
}

export type AdvanceParams = {
  apyBps: number
  maxAdvanceBps: number
  minTermDays: number
  maxTermDays: number
  perUserCap: string
  globalCap: string
  allowlistOn: boolean
}

export type AdvanceState = {
  position: AdvancePositionRow | null
  unlockStatus: { valueNow: string; unlockValue: string; covered: boolean } | null
  params?: AdvanceParams
  treasury?: string
}

type ErrorBody = { error?: string }

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & ErrorBody
  if (!res.ok) throw new Error(data.error || `${fallback} (HTTP ${res.status})`)
  return data
}

async function getJson<T>(path: string, params: Record<string, string>, fallback: string): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${path}?${qs}`, {
    headers: { Accept: 'application/json', ...(await seyfAuthHeaders()) },
    cache: 'no-store',
  })
  return readJson<T>(res, fallback)
}

async function postJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await seyfAuthHeaders()) },
    body: JSON.stringify(body ?? {}),
  })
  return readJson<T>(res, fallback)
}

export const getVaultPosition = (address: string) =>
  getJson<VaultPosition>('/api/vault/position', { address }, 'No se pudo leer tu ahorro')

export const getAdvanceQuote = (address: string, shares: string, termDays: number) =>
  getJson<AdvanceQuote>(
    '/api/advance/quote',
    { address, shares, termDays: String(termDays) },
    'No se pudo cotizar el adelanto',
  )

export const getAdvancePosition = (address: string) =>
  getJson<AdvanceState>('/api/advance/position', { address }, 'No se pudo leer tu adelanto')

export type VaultAction =
  | { action: 'deposit'; address: string; amount: string }
  | { action: 'withdraw'; address: string; shares: string }

export type AdvanceAction =
  | { action: 'open'; address: string; shares: string; termDays: number; minAdvance: string }
  | { action: 'repay'; address: string }
  | { action: 'settle'; address: string }

/** Firma con Pollar y envía por fee-bump. Devuelve el hash. */
export async function signAndSubmit(
  client: PollarClient,
  publicKey: string,
  xdr: string,
): Promise<string> {
  const signedXdr = await pollarSignXdr(client, xdr, publicKey)
  const data = await postJson<{ txHash?: string }>(
    '/api/stellar/sponsor/submit',
    { signedXdr },
    'La transacción no se confirmó en la red',
  )
  if (!data.txHash) throw new Error('La red no devolvió el hash de la transacción')
  return data.txHash
}

/** POST a la ruta que arma el XDR → firma → envío. */
export async function buildSignSubmit(
  client: PollarClient,
  publicKey: string,
  path: '/api/vault/build' | '/api/advance/build',
  body: VaultAction | AdvanceAction,
): Promise<string> {
  const { xdr } = await postJson<{ xdr?: string }>(path, body, 'No se pudo preparar la operación')
  if (!xdr) throw new Error('El servidor no devolvió la transacción a firmar')
  return signAndSubmit(client, publicKey, xdr)
}

/** Crea la cuenta con reserva patrocinada. `null` si ya existía (Pollar la creó). */
export async function sponsorCreateAccount(client: PollarClient, publicKey: string): Promise<string | null> {
  const data = await postJson<{ xdr?: string; exists?: boolean }>(
    '/api/stellar/sponsor/create-account',
    {},
    'No se pudo crear tu cuenta Stellar',
  )
  if (data.exists) return null
  if (!data.xdr) throw new Error('El servidor no devolvió la transacción a firmar')
  return signAndSubmit(client, publicKey, data.xdr)
}

export async function sponsorTrustline(
  client: PollarClient,
  publicKey: string,
  assetCode: string,
  assetIssuer: string,
): Promise<string> {
  const { xdr } = await postJson<{ xdr?: string }>(
    '/api/stellar/sponsor/trustline',
    { assetCode, assetIssuer },
    'No se pudo abrir la línea de USDC',
  )
  if (!xdr) throw new Error('El servidor no devolvió la transacción a firmar')
  return signAndSubmit(client, publicKey, xdr)
}

/**
 * USDC de Circle en mainnet. En testnet hay varios emisores que no comparten
 * liquidez: el vault de DeFindex usa el USDC de Blend testnet.
 */
const USDC_ISSUER_MAINNET = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
const USDC_ISSUER_TESTNET = 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56'

export function usdcIssuer(network: 'mainnet' | 'testnet'): string {
  const override = process.env.NEXT_PUBLIC_STELLAR_USDC_ISSUER?.trim()
  if (override) return override
  return network === 'mainnet' ? USDC_ISSUER_MAINNET : USDC_ISSUER_TESTNET
}

export type AccountState =
  | { exists: false }
  | { exists: true; xlm: string; usdcTrustline: boolean; usdc: string }

type HorizonBalance = {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
  balance: string
}

/** Estado de la cuenta en el ledger: existe, trustline USDC y saldos (texto decimal). */
export async function getAccountState(publicKey: string, issuer: string): Promise<AccountState> {
  const res = await fetch(`${horizonUrl()}/accounts/${encodeURIComponent(publicKey)}`, {
    cache: 'no-store',
  })
  if (res.status === 404) return { exists: false }
  if (!res.ok) throw new Error(`No se pudo leer tu cuenta en la red (HTTP ${res.status})`)
  const data = (await res.json()) as { balances?: HorizonBalance[] }
  const balances = data.balances ?? []
  const usdc = balances.find((b) => b.asset_code === 'USDC' && b.asset_issuer === issuer)
  const xlm = balances.find((b) => b.asset_type === 'native')
  return {
    exists: true,
    xlm: xlm?.balance ?? '0',
    usdcTrustline: Boolean(usdc),
    usdc: usdc?.balance ?? '0',
  }
}
