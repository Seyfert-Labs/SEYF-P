import { NextResponse } from 'next/server'
import { z } from 'zod'
import { soroswapSend, SoroswapApiError } from '@/lib/soroswap/client'

const bodySchema = z.object({
  // XDR ya firmado por Pollar.
  signedXdr: z.string().trim().min(1),
})

function extractHash(res: Record<string, unknown>): string | null {
  const h =
    (res.txHash as string) ||
    (res.hash as string) ||
    ((res.transaction as { hash?: string } | undefined)?.hash ?? '')
  return typeof h === 'string' && h.trim() ? h.trim() : null
}

/**
 * POST /api/soroswap/send { signedXdr }
 * Reenvía a la red el XDR firmado y devuelve el hash de la transacción.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  try {
    const res = await soroswapSend(parsed.data.signedXdr)
    const txHash = extractHash(res)
    if (!txHash) {
      console.error('[soroswap/send] respuesta sin hash:', JSON.stringify(res).slice(0, 300))
      return NextResponse.json({ error: 'La transacción no se confirmó en la red', raw: res }, { status: 502 })
    }
    return NextResponse.json({ txHash, success: true })
  } catch (e) {
    const status = e instanceof SoroswapApiError ? (e.status >= 400 ? e.status : 502) : 502
    const message = e instanceof Error ? e.message : 'No se pudo enviar la transacción'
    console.error('[soroswap/send]', message)
    return NextResponse.json({ error: message }, { status })
  }
}
