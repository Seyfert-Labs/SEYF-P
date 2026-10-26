'use client'

/**
 * Lado cliente de SEP-10: pide el challenge, lo firma con Pollar (API v3,
 * `/v3/stellar/sep10/sign`) y guarda la sesión. La firma NO se envía a la red —
 * es solo la prueba de que el usuario controla su llave.
 */

import type { PollarClient } from '@pollar/core'
import { TransactionBuilder, type Transaction } from '@stellar/stellar-sdk'
import { pollarSignSep10Challenge } from '@/lib/pollar/client-api'
import { stellarNetworkPassphrase } from '@/lib/stellar/network'
import {
  peekSeyfAuthToken,
  setSeyfAuthInflight,
  setSeyfAuthToken,
} from '@/lib/stellar/auth-token'

type ChallengeResponse = { transaction?: string; network_passphrase?: string; error?: string }
type TokenResponse = { token?: string; expires_in?: number; account?: string; error?: string }

/**
 * Lee home domain y web_auth_domain del challenge (ops `manageData`
 * "<home_domain> auth" y "web_auth_domain") y comprueba que vaya a nombre de
 * `publicKey`. Pollar los recibe para validar el challenge antes de firmar.
 */
function challengeDomains(
  challengeXdr: string,
  passphrase: string,
  publicKey: string,
): { homeDomains?: string[]; webAuthDomain?: string } {
  const tx = TransactionBuilder.fromXDR(challengeXdr, passphrase) as Transaction
  const [first, ...rest] = tx.operations ?? []
  if (!first || first.type !== 'manageData' || first.source !== publicKey) {
    throw new Error('El challenge no corresponde a tu cuenta. No se firmó nada.')
  }
  const homeDomain = first.name.endsWith(' auth') ? first.name.slice(0, -' auth'.length) : ''
  const webAuthOp = rest.find((op) => op.type === 'manageData' && op.name === 'web_auth_domain')
  const webAuthDomain =
    webAuthOp && webAuthOp.type === 'manageData' && webAuthOp.value
      ? webAuthOp.value.toString('utf8')
      : undefined
  return { homeDomains: homeDomain ? [homeDomain] : undefined, webAuthDomain }
}

async function mintToken(client: PollarClient, publicKey: string): Promise<string | null> {
  const challengeRes = await fetch(`/api/auth/sep10?account=${encodeURIComponent(publicKey)}`, {
    headers: { Accept: 'application/json' },
  })
  const challenge = (await challengeRes.json().catch(() => ({}))) as ChallengeResponse
  if (!challengeRes.ok || !challenge.transaction) {
    throw new Error(challenge.error || 'No se pudo iniciar la sesión segura.')
  }

  // No firmar nunca un challenge de otra red: en mainnet, una passphrase que no
  // coincide con la configurada significa servidor mal apuntado o manipulado.
  // (Checklist de seguridad Soroban: validar network passphrase ANTES de firmar.)
  const expectedPassphrase = stellarNetworkPassphrase()
  if (challenge.network_passphrase !== expectedPassphrase) {
    throw new Error('La red del challenge no coincide con la configurada. No se firmó nada.')
  }

  const signedXdr = await pollarSignSep10Challenge(client, {
    address: publicKey,
    challengeXdr: challenge.transaction,
    networkPassphrase: expectedPassphrase,
    ...challengeDomains(challenge.transaction, expectedPassphrase, publicKey),
  })

  const tokenRes = await fetch('/api/auth/sep10', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedXdr }),
  })
  const token = (await tokenRes.json().catch(() => ({}))) as TokenResponse
  if (!tokenRes.ok || !token.token) {
    throw new Error(token.error || 'No se pudo validar tu firma.')
  }

  setSeyfAuthToken(token.token, token.account ?? publicKey, token.expires_in ?? 86_400)
  return token.token
}

/**
 * Devuelve un token de sesión válido, firmando un challenge si hace falta.
 * Idempotente: varias llamadas concurrentes comparten el mismo minteo.
 */
export async function ensureSeyfSession(
  client: PollarClient,
  publicKey: string,
): Promise<string | null> {
  const existing = peekSeyfAuthToken()
  if (existing) return existing

  const promise = mintToken(client, publicKey).catch((e) => {
    console.warn('[sep10] no se pudo abrir la sesión:', e instanceof Error ? e.message : e)
    return null
  })
  setSeyfAuthInflight(promise)
  try {
    return await promise
  } finally {
    setSeyfAuthInflight(null)
  }
}
