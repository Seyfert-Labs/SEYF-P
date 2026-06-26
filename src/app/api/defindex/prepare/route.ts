import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prepareSorobanXdr } from '@/lib/defindex/prepare-xdr'

const bodySchema = z.object({
  xdr: z.string().trim().min(1),
})

/**
 * POST /api/defindex/prepare { xdr }
 * Re-simula y ajusta el resource fee Soroban justo antes de firmar.
 */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const xdr = await prepareSorobanXdr(parsed.data.xdr)
    return NextResponse.json({ xdr })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo preparar la transacción'
    console.error('[defindex/prepare]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
