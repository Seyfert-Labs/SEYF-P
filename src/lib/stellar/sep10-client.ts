'use client'

/**
 * Lado cliente de SEP-10: pide el challenge, lo firma con Pollar (API v3,
 * `/v3/stellar/sep10/sign`) y guarda la sesión. La firma NO se envía a la red —
 * es solo la prueba de que el usuario controla su llave.
 */

import type { PollarClient } from '@pollar/core'
import { TransactionBuilder, type Transaction } from '@stellar/stellar-sdk'
import { pollarSignAccountProof, pollarSignSep10Challenge } from '@/lib/pollar/client-api'
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

async function fetchChallenge(publicKey: string, mode?: 'account'): Promise<string> {
  const q = `account=${encodeURIComponent(publicKey)}${mode ? `&mode=${mode}` : ''}`
  const challengeRes = await fetch(`/api/auth/sep10?${q}`, { headers: { Accept: 'application/json' } })
  const challenge = (await challengeRes.json().catch(() => ({}))) as ChallengeResponse
  if (!challengeRes.ok || !challenge.transaction) {
    throw new Error(challenge.error || 'No se pudo iniciar la sesión segura.')
  }
  // No firmar nunca un challenge de otra red: en mainnet, una passphrase que no
  // coincide con la configurada significa servidor mal apuntado o manipulado.
  // (Checklist de seguridad Soroban: validar network passphrase ANTES de firmar.)
  if (challenge.network_passphrase !== stellarNetworkPassphrase()) {
    throw new Error('La red del challenge no coincide con la configurada. No se firmó nada.')
  }
  return challenge.transaction
}

async function exchange(signedXdr: string, publicKey: string, mode?: 'account'): Promise<string> {
  const tokenRes = await fetch('/api/auth/sep10', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedXdr, ...(mode ? { mode } : {}) }),
  })
  const token = (await tokenRes.json().catch(() => ({}))) as TokenResponse
  if (!tokenRes.ok || !token.token) {
    throw new Error(token.error || 'No se pudo validar tu firma.')
  }
  setSeyfAuthToken(token.token, token.account ?? publicKey, token.expires_in ?? 86_400)
  return token.token
}

let deviceNotEnrolled = false

/** El último intento falló porque este navegador no está dado de alta en la wallet de Pollar. */
export function sep10DeviceNotEnrolled(): boolean {
  return deviceNotEnrolled
}

/**
 * Sesión con un mensaje firmado (SEP-53). No es una transacción, así que Pollar no
 * muestra "Confirm transaction" y el usuario no ve una firma que no pidió.
 */
async function mintWithMessage(client: PollarClient, publicKey: string): Promise<string> {
  const q = `account=${encodeURIComponent(publicKey)}&mode=message`
  const res = await fetch(`/api/auth/sep10?${q}`, { headers: { Accept: 'application/json' } })
  const { message, challenge, error } = (await res.json().catch(() => ({}))) as {
    message?: string
    challenge?: string
    error?: string
  }
  if (!res.ok || !message || !challenge) throw new Error(error || 'No se pudo iniciar la sesión segura.')
  // Solo se firma un mensaje de inicio de sesión para esta cuenta, nunca otra cosa.
  if (!message.includes(' inicio de sesión\n') || !message.includes(`\nCuenta: ${publicKey}\n`)) {
    throw new Error('El mensaje de sesión no corresponde a tu cuenta. No se firmó nada.')
  }

  const out = await client.stellar.sep53.signMessage(message)
  if (out.status !== 'signed') throw new Error(out.details || out.code || 'Pollar no pudo firmar el mensaje')
  if (out.signerAddress !== publicKey) throw new Error('La firma no corresponde a tu cuenta.')

  const tokenRes = await fetch('/api/auth/sep10', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'message', message, challenge, signature: out.signature }),
  })
  const token = (await tokenRes.json().catch(() => ({}))) as TokenResponse
  if (!tokenRes.ok || !token.token) throw new Error(token.error || 'No se pudo validar tu firma.')
  setSeyfAuthToken(token.token, token.account ?? publicKey, token.expires_in ?? 86_400)
  return token.token
}

async function mintToken(client: PollarClient, publicKey: string): Promise<string | null> {
  const passphrase = stellarNetworkPassphrase()
  deviceNotEnrolled = false

  // 0) Mensaje firmado: sin diálogo de confirmación.
  try {
    return await mintWithMessage(client, publicKey)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    deviceNotEnrolled = msg.includes('SDK_COSIGN_DEVICE_NOT_ENROLLED')
    if (deviceNotEnrolled) throw e
    console.info('[sep10] mensaje firmado no disponible, uso prueba de cuenta:', msg)
  }

  // 1) Prueba de cuenta (transacción con secuencia 0; Pollar pide confirmarla). La app de Pollar es cosignada (Turnkey) y ahí
  //    /stellar/sep10/sign siempre responde 502: intentarlo primero solo sumaba
  //    una ida y vuelta y un error en cada inicio de sesión.
  try {
    const proofXdr = await fetchChallenge(publicKey, 'account')
    const signedProof = await pollarSignAccountProof(client, proofXdr, publicKey, passphrase)
    return await exchange(signedProof, publicKey, 'account')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Este navegador no es un dispositivo de la wallet: el SEP-10 estándar
    // también falla (502). Hay que darlo de alta con la passkey o el correo.
    deviceNotEnrolled = msg.includes('SDK_COSIGN_DEVICE_NOT_ENROLLED')
    if (deviceNotEnrolled) throw e
    console.info('[sep10] prueba de cuenta no disponible, uso SEP-10 estándar:', msg)
  }

  // 2) SEP-10 estándar (wallets que Pollar firma del lado del servidor).
  const challengeXdr = await fetchChallenge(publicKey)
  const signedXdr = await pollarSignSep10Challenge(client, {
    address: publicKey,
    challengeXdr,
    ...challengeDomains(challengeXdr, passphrase, publicKey),
  })
  return exchange(signedXdr, publicKey)
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
