import { NextResponse } from 'next/server'
import { z } from 'zod'
import { soroswapBuild, SoroswapApiError } from '@/lib/soroswap/client'

const bodySchema = z.object({
  // Cotización opaca devuelta por /api/soroswap/quote (se reenvía tal cual).
  quote: z.record(z.string(), z.unknown()),
  // Public key Stellar del usuario (wallet Pollar) que firma y recibe.
  from: z.string().trim().min(1),
})

/**
 * POST /api/soroswap/build { quote, from }
 * Construye el XDR (sin firmar) del swap. El cliente lo firma con Pollar y lo
 * envía a /api/soroswap/send.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  try {
    const { xdr } = await soroswapBuild(parsed.data.quote, parsed.data.from)
    if (!xdr) {
      return NextResponse.json({ error: 'Soroswap no devolvió XDR' }, { status: 502 })
    }
    return NextResponse.json({ xdr })
  } catch (e) {
    const status = e instanceof SoroswapApiError ? (e.status >= 400 ? e.status : 502) : 502
    const message = e instanceof Error ? e.message : 'No se pudo construir la transacción'
    console.error('[soroswap/build]', message)
    return NextResponse.json({ error: message }, { status })
  }
}
