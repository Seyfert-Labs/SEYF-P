'use client'

import type { PollarClient } from '@pollar/core'
import { TransactionBuilder } from '@stellar/stellar-sdk'
import { readPollarAccessToken, readPollarPublicKey } from '@/lib/pollar/session'

type PollarSessionSlice = {
  token?: { accessToken?: string }
  wallet?: { publicKey?: string | null; address?: string | null }
  data?: { providers?: { wallet?: { address?: string } } }
}

type PollarApiClient = {
  POST: (
    path: string,
    opts: { body: Record<string, unknown> },
  ) => Promise<{ data?: unknown; error?: { details?: string; message?: string } }>
}

function pollarApi(client: PollarClient): PollarApiClient | null {
  const api = (client as unknown as { _api?: PollarApiClient })._api
  return api ?? null
}

function sessionFromClient(client: PollarClient): PollarSessionSlice | null {
  return (client as unknown as { _session?: PollarSessionSlice | null })._session ?? null
}

/** Public key activa: memoria del cliente (fresca) → localStorage. */
export function resolvePollarPublicKey(client: PollarClient): string | null {
  const mem = sessionFromClient(client)
  const fromMem =
    mem?.wallet?.address?.trim() ||
    mem?.wallet?.publicKey?.trim() ||
    mem?.data?.providers?.wallet?.address?.trim()
  if (fromMem) return fromMem
  return readPollarPublicKey()
}

function resolvePollarAccessToken(client: PollarClient): string | null {
  const fromMem = sessionFromClient(client)?.token?.accessToken?.trim()
  if (fromMem) return fromMem
  return readPollarAccessToken()
}

/**
 * Espera a que Pollar termine el login OTP y tenga token + wallet listos para firmar.
 * Evita carreras cuando el modal de abonar se abre justo después del código.
 */
export async function waitForPollarSession(
  getClient: () => PollarClient,
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<{ publicKey: string; client: PollarClient }> {
  const timeoutMs = opts?.timeoutMs ?? 20_000
  const pollMs = opts?.pollMs ?? 120
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const client = getClient()
    const auth = client.getAuthState()
    const publicKey = resolvePollarPublicKey(client)
    const token = resolvePollarAccessToken(client)

    if (auth.step === 'error') {
      throw new Error(auth.message || 'No se pudo conectar tu wallet Stellar')
    }

    if (auth.step === 'authenticated' && publicKey && token) {
      return { publicKey, client }
    }

    await new Promise((r) => setTimeout(r, pollMs))
  }

  throw new Error(
    'Tu wallet Stellar aún se está activando. Espera unos segundos e intenta abonar de nuevo.',
  )
}

type SignContent = {
  signedXdr?: string
  signedTxXdr?: string
  signedEnvelopeXdr?: string
  xdr?: string
}

function extractSignedXdr(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const root = data as { content?: SignContent; signedXdr?: string }
  const c = root.content ?? root
  const signed =
    (c as SignContent).signedXdr?.trim() ||
    (c as SignContent).signedTxXdr?.trim() ||
    (c as SignContent).signedEnvelopeXdr?.trim() ||
    (c as SignContent).xdr?.trim() ||
    root.signedXdr?.trim()
  return signed || null
}

function pollarApiError(data: unknown, error: { details?: string; message?: string } | undefined, fallback: string): string {
  if (data && typeof data === 'object') {
    const code = (data as { code?: string }).code?.trim()
    if (code === 'ORIGIN_NOT_ALLOWED') {
      return 'Este dominio no está autorizado en Pollar. Agrega tu URL en el dashboard de Pollar (testnet).'
    }
    if (code === 'API_KEY_TYPE_NOT_ALLOWED' || code === 'API_KEY_NOT_FOUND') {
      return `La API key de Pollar no sirve para esta operación (${code}). Revisa NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY.`
    }
    if (code === 'UNAUTHORIZED' || code === 'SESSION_EXPIRED') {
      return 'Tu sesión Stellar expiró. Vuelve a ingresar el código OTP.'
    }
    const msg = (data as { message?: string }).message?.trim()
    if (msg) return msg
  }
  const d = error?.details?.trim() || error?.message?.trim()
  return d || fallback
}

/**
 * Firma un XDR externo usando el cliente Pollar (API key + Bearer en memoria).
 */
export async function pollarSignXdr(client: PollarClient, unsignedXdr: string, publicKey: string): Promise<string> {
  void publicKey // Pollar ≥0.12 firma con la wallet de la sesión.
  // skipSponsorship: el fee-bump lo pone SEYF en el servidor; Pollar solo firma.
  const out = await client.signTx(unsignedXdr, { skipSponsorship: true })
  if (out.status === 'signed') return out.signedXdr
  if (out.status === 'cosign_pending') {
    throw new Error('Tu wallet pide una aprobación adicional. Complétala e intenta de nuevo.')
  }
  throw new Error(pollarApiError({ code: out.code }, { details: out.details }, 'Pollar no pudo firmar la transacción'))
}

/** Origen de la API de Pollar sin el sufijo de versión (`…/v1` → `…`). */
function pollarApiOrigin(client: PollarClient): string {
  const basePath = (client as unknown as { basePath?: string }).basePath?.trim()
  const origin = basePath ? basePath.replace(/\/v\d+\/?$/, '') : ''
  return origin || 'https://sdk.api.pollar.xyz'
}

/** Misma llave publicable que monta `SeyfPollarProvider`. */
function pollarPublishableKey(client: PollarClient): string | null {
  const fromClient = (client as unknown as { apiKey?: string }).apiKey?.trim()
  return (
    fromClient ||
    process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_POLLAR_API_KEY?.trim() ||
    null
  )
}

export type PollarSep10SignInput = {
  address: string
  challengeXdr: string
  networkPassphrase: string
  homeDomains?: string[]
  webAuthDomain?: string
}

/**
 * Antes de firmar un challenge por la vía genérica de transacciones: tiene que ser
 * un challenge SEP-10 de verdad (secuencia 0, imposible de enviar a la red; solo
 * `manageData`; la primera operación a nombre de la cuenta del usuario).
 */
function assertSep10Shape(xdr: string, address: string, networkPassphrase: string): void {
  const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase)
  const ops = 'operations' in tx ? tx.operations : []
  const ok =
    'sequence' in tx &&
    tx.sequence === '0' &&
    ops.length > 0 &&
    ops.every((op) => op.type === 'manageData') &&
    ops[0].source === address
  if (!ok) throw new Error('El challenge de sesión no es válido. No se firmó nada.')
}

/**
 * Firma un challenge SEP-10 con la API v3 de Pollar (`/v3/stellar/sep10/sign`).
 * `/v1/tx/sign` no firma challenges SEP-10. La red la fija la API key; el resto
 * de firmas sigue por `pollarSignXdr`.
 */
export async function pollarSignSep10Challenge(
  client: PollarClient,
  input: PollarSep10SignInput,
): Promise<string> {
  const out = await client.stellar.sep10.sign({
    challengeXdr: input.challengeXdr,
    ...(input.homeDomains?.length ? { homeDomains: input.homeDomains } : {}),
    ...(input.webAuthDomain ? { webAuthDomain: input.webAuthDomain } : {}),
  })
  if (out.status === 'signed') {
    if (out.signerAddress && out.signerAddress !== input.address) {
      throw new Error('La firma SEP-10 no corresponde a tu cuenta. Vuelve a entrar.')
    }
    return out.signedXdr
  }

  // Wallets de Turnkey (co-firma 2 de 2 o autocustodia): `/stellar/sep10/sign` firma
  // solo del lado de Pollar y falla con INTERNAL_ERROR, porque la llave necesita al
  // dispositivo. `signTx` sí pasa por la co-firma del dispositivo. El challenge ya se
  // validó en `sep10-client` (red y dominios) y, con secuencia 0 y la cuenta del
  // servidor como origen, no se puede enviar a la red: firmarlo solo prueba la cuenta.
  assertSep10Shape(input.challengeXdr, input.address, input.networkPassphrase)
  const viaTx = await client.signTx(input.challengeXdr, { skipSponsorship: true })
  if (viaTx.status === 'signed') return viaTx.signedXdr
  if (viaTx.status === 'cosign_pending') {
    throw new Error('Aprueba la firma en tu dispositivo para abrir tu sesión segura.')
  }
  throw new Error(
    pollarApiError({ code: viaTx.code ?? out.code }, { details: viaTx.details ?? out.details }, 'Pollar no pudo firmar el challenge SEP-10'),
  )
}
