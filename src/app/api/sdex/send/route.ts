import { NextResponse } from 'next/server'
import { z } from 'zod'
import { submitSignedStellarXdr } from '@/lib/stellar/path-payment'

const bodySchema = z.object({
  signedXdr: z.string().trim().min(1),
})

/** POST /api/sdex/send — envía el XDR firmado a Horizon. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  try {
    const txHash = await submitSignedStellarXdr(parsed.data.signedXdr)
    return NextResponse.json({ txHash, success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo enviar la transacción'
    console.error('[sdex/send]', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
