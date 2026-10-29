import { NextResponse } from 'next/server'
import {
  Sep10NotConfiguredError,
  buildAccountProofChallenge,
  buildMessageChallenge,
  buildSep10Challenge,
  issueSeyfSession,
  verifyAccountProof,
  verifyMessageProof,
  verifySep10Challenge,
} from '@/lib/stellar/sep10'
import { rateLimitResponse } from '@/lib/seyf/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const noStore = { 'Cache-Control': 'no-store' }

function configError(e: unknown): NextResponse | null {
  if (e instanceof Sep10NotConfiguredError) {
    console.error('[auth/sep10]', e.message)
    return NextResponse.json({ error: e.message }, { status: 503, headers: noStore })
  }
  return null
}

/** GET /api/auth/sep10?account=G... — challenge SEP-10 para firmar. */
export async function GET(request: Request) {
  const limited = await rateLimitResponse(request, 'auth/sep10-challenge', {
    limit: 30,
    windowSec: 300,
  })
  if (limited) return limited

  const params = new URL(request.url).searchParams
  const account = params.get('account')?.trim()
  // mode=account: prueba de cuenta para wallets que solo firman txs propias (Turnkey).
  const accountProof = params.get('mode') === 'account'
  if (!account) {
    return NextResponse.json({ error: 'account requerido' }, { status: 400, headers: noStore })
  }

  try {
    // mode=message: mensaje SEP-53 (no es una transacción; Pollar no pide confirmarlo).
    if (params.get('mode') === 'message') {
      const { message, challenge } = buildMessageChallenge(account)
      return NextResponse.json({ message, challenge }, { headers: noStore })
    }
    const { transaction, networkPassphrase } = accountProof
      ? buildAccountProofChallenge(account)
      : buildSep10Challenge(account)
    // Nombres de campo del propio SEP-10, para que cualquier wallet estándar lo entienda.
    return NextResponse.json(
      { transaction, network_passphrase: networkPassphrase },
      { headers: noStore },
    )
  } catch (e) {
    const cfg = configError(e)
    if (cfg) return cfg
    const message = e instanceof Error ? e.message : 'No se pudo generar el challenge'
    return NextResponse.json({ error: message }, { status: 400, headers: noStore })
  }
}

/** POST /api/auth/sep10 { transaction } — valida la firma y emite la sesión SEYF. */
export async function POST(request: Request) {
  const limited = await rateLimitResponse(request, 'auth/sep10-token', { limit: 30, windowSec: 300 })
  if (limited) return limited

  const body = (await request.json().catch(() => null)) as {
    transaction?: unknown
    mode?: unknown
    message?: unknown
    challenge?: unknown
    signature?: unknown
  } | null

  if (body?.mode === 'message') {
    const str = (v: unknown) => (typeof v === 'string' ? v : '')
    if (!str(body.message) || !str(body.challenge) || !str(body.signature)) {
      return NextResponse.json({ error: 'message, challenge y signature requeridos' }, { status: 400, headers: noStore })
    }
    try {
      const account = await verifyMessageProof(str(body.message), str(body.challenge), str(body.signature))
      const { token, expiresIn } = issueSeyfSession(account)
      return NextResponse.json({ token, expires_in: expiresIn, account }, { headers: noStore })
    } catch (e) {
      const cfg = configError(e)
      if (cfg) return cfg
      console.warn('[auth/sep10] mensaje rechazado:', e instanceof Error ? e.message : e)
      return NextResponse.json({ error: 'Firma de sesión inválida.' }, { status: 401, headers: noStore })
    }
  }

  const signedXdr = typeof body?.transaction === 'string' ? body.transaction.trim() : ''
  if (!signedXdr) {
    return NextResponse.json({ error: 'transaction requerido' }, { status: 400, headers: noStore })
  }

  try {
    const account =
      body?.mode === 'account' ? await verifyAccountProof(signedXdr) : await verifySep10Challenge(signedXdr)
    const { token, expiresIn } = issueSeyfSession(account)
    return NextResponse.json(
      { token, expires_in: expiresIn, account },
      { headers: noStore },
    )
  } catch (e) {
    const cfg = configError(e)
    if (cfg) return cfg
    const message = e instanceof Error ? e.message : 'Challenge inválido'
    console.warn('[auth/sep10] challenge rechazado:', message)
    return NextResponse.json({ error: 'Challenge inválido o no firmado correctamente.' }, {
      status: 401,
      headers: noStore,
    })
  }
}
