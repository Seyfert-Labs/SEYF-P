import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  SponsorForbiddenError,
  SponsorNotConfiguredError,
  SponsorRejectedError,
  submitFeeBumped,
} from '@/lib/stellar/sponsor'
import { requireSession } from '@/lib/stellar/db-auth'
import { rateLimitResponse } from '@/lib/seyf/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

const bodySchema = z.object({ signedXdr: z.string().trim().min(1) })

/**
 * POST /api/stellar/sponsor/submit
 * Envuelve en fee-bump la transacción firmada por el usuario y la envía:
 * el negocio paga la comisión. Solo se aceptan transacciones cuya fuente sea
 * la cuenta de la sesión o el propio sponsor, de cuentas de la beta, con
 * operaciones del adelanto, el vault USDC, el SAC de USDC o la trustline USDC,
 * y con el `resourceFee` bajo `STELLAR_SPONSOR_MAX_RESOURCE_FEE`.
 * Un fee-bump ya armado (patrocinio de Pollar encendido) se rechaza con 400.
 */
export async function POST(request: Request) {
  const limited = await rateLimitResponse(request, 'sponsor/submit', { limit: 60, windowSec: 3600 })
  if (limited) return limited

  const session = requireSession(request)
  if (!session.ok) return session.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers: noStore })
  }

  try {
    const result = await submitFeeBumped(parsed.data.signedXdr, session.account)
    return NextResponse.json(
      { txHash: result.hash, successful: result.successful },
      { headers: noStore },
    )
  } catch (e) {
    if (e instanceof SponsorForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403, headers: noStore })
    }
    if (e instanceof SponsorRejectedError) {
      return NextResponse.json({ error: e.message }, { status: 400, headers: noStore })
    }
    if (e instanceof SponsorNotConfiguredError) {
      console.error('[sponsor/submit]', e.message)
      return NextResponse.json({ error: e.message }, { status: 503, headers: noStore })
    }
    const message = e instanceof Error ? e.message : 'No se pudo enviar la transacción'
    console.error('[sponsor/submit]', message)
    return NextResponse.json({ error: message }, { status: 502, headers: noStore })
  }
}
