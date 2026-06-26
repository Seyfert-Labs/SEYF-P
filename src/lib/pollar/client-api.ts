'use client'

import type { PollarClient } from '@pollar/core'
import { readPollarAccessToken, readPollarPublicKey } from '@/lib/pollar/session'

type PollarSessionSlice = {
  token?: { accessToken?: string }
  wallet?: { publicKey?: string | null }
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
    mem?.wallet?.publicKey?.trim() || mem?.data?.providers?.wallet?.address?.trim()
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
  const api = pollarApi(client)
  if (!api) {
    throw new Error('Cliente Pollar no inicializado. Recarga la página e intenta de nuevo.')
  }

  const network = client.getNetwork()
  const body = { network, publicKey, unsignedXdr }

  const { data, error } = await api.POST('/tx/sign', { body })
  const signed = extractSignedXdr(data)
  if (signed) return signed

  throw new Error(pollarApiError(data, error, 'Pollar no pudo firmar la transacción'))
}
