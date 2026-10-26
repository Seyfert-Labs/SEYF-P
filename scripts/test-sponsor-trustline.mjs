#!/usr/bin/env node
/**
 * test-sponsor-trustline — prueba en TESTNET de la trustline USDC patrocinada,
 * con origen = cuenta del usuario (como la firma Pollar `/tx/sign`).
 *
 * Por cada cuenta: SEP-10 → create-account (0 XLM, reserva del sponsor) →
 * trustline → submit por fee-bump. La primera envía las dos firmas (sponsor +
 * usuario); la segunda solo la del usuario, para comprobar que el servidor
 * repone la del sponsor. Al final verifica en Horizon que la trustline quedó
 * patrocinada y que el XLM del usuario sigue en 0.
 *
 * Uso (servidor en testnet con las dos cuentas en SEYF_BETA_ALLOWLIST):
 *   SEYF_TEST_USER_SECRETS=S…,S… SEYF_TEST_USDC_ISSUER=G… \
 *     node scripts/test-sponsor-trustline.mjs [http://localhost:3000]
 * Las cuentas deben ser nuevas (sin crear en el ledger).
 */

import { Keypair, Networks, Transaction, TransactionBuilder } from '@stellar/stellar-sdk'

const BASE = process.argv[2] || 'http://localhost:3000'
const PASS = Networks.TESTNET
const HORIZON = 'https://horizon-testnet.stellar.org'
const ISSUER = process.env.SEYF_TEST_USDC_ISSUER?.trim()
const secrets = (process.env.SEYF_TEST_USER_SECRETS || '').split(',').map((s) => s.trim()).filter(Boolean)
if (secrets.length < 2 || !ISSUER) {
  console.error('Faltan SEYF_TEST_USER_SECRETS (dos llaves S… de testnet) o SEYF_TEST_USDC_ISSUER.')
  process.exit(2)
}

const results = []
const check = (name, ok, extra = '') => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
}

async function api(path, { token, body, method = 'POST' } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

async function login(kp) {
  const ch = await api(`/api/auth/sep10?account=${kp.publicKey()}`, { method: 'GET' })
  if (ch.data.network_passphrase !== PASS) throw new Error('El servidor no está en testnet. Abortado.')
  const tx = new Transaction(ch.data.transaction, PASS)
  tx.sign(kp)
  return (await api('/api/auth/sep10', { body: { transaction: tx.toXDR() } })).data.token
}

for (const [i, secret] of secrets.slice(0, 2).entries()) {
  const user = Keypair.fromSecret(secret)
  const keepSponsorSig = i === 0
  const label = keepSponsorSig ? 'A (sponsor + usuario)' : 'B (solo usuario)'
  const token = await login(user)
  check(`${label}: SEP-10`, token)

  let r = await api('/api/stellar/sponsor/create-account', { token })
  if (r.data.xdr) {
    const create = TransactionBuilder.fromXDR(r.data.xdr, PASS)
    create.sign(user)
    r = await api('/api/stellar/sponsor/submit', { token, body: { signedXdr: create.toXDR() } })
    check(`${label}: cuenta creada con 0 XLM`, r.status === 200 && r.data.successful, r.data.txHash || r.data.error)
  } else {
    check(`${label}: cuenta nueva`, false, JSON.stringify(r.data))
  }

  r = await api('/api/stellar/sponsor/trustline', { token, body: { assetCode: 'USDC', assetIssuer: ISSUER } })
  const tx = TransactionBuilder.fromXDR(r.data.xdr, PASS)
  const sponsor = tx.operations[0]?.source
  check(
    `${label}: XDR con origen = usuario y firma del sponsor`,
    tx.source === user.publicKey() && tx.signatures.length === 1 && sponsor && sponsor !== user.publicKey(),
  )
  if (!keepSponsorSig) tx.signatures.splice(0, tx.signatures.length)
  tx.sign(user)
  r = await api('/api/stellar/sponsor/submit', { token, body: { signedXdr: tx.toXDR() } })
  check(`${label}: submit con ${tx.signatures.length} firma(s)`, r.status === 200 && r.data.successful, r.data.txHash || r.data.error)

  const acct = await fetch(`${HORIZON}/accounts/${user.publicKey()}`).then((res) => res.json())
  const usdc = acct.balances?.find((b) => b.asset_code === 'USDC' && b.asset_issuer === ISSUER)
  const xlm = acct.balances?.find((b) => b.asset_type === 'native')
  check(
    `${label}: trustline patrocinada por el sponsor y XLM en 0`,
    usdc?.sponsor === sponsor && Number(xlm?.balance) === 0,
    `sponsor=${usdc?.sponsor ?? '—'} xlm=${xlm?.balance ?? '—'}`,
  )
}

const passed = results.filter(Boolean).length
console.log(`${passed}/${results.length} PASS`)
process.exit(passed === results.length ? 0 : 1)
