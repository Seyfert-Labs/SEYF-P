import { NextResponse } from 'next/server'
import { advanceActivity } from '@/lib/advance/activity'
import { errorResponse } from '@/lib/advance/http'

export const runtime = 'nodejs'
// Datos públicos de la cadena: se cachean y se recalculan cada 5 minutos, así
// las visitas a la landing no llegan al RPC.
export const dynamic = 'force-static'
export const revalidate = 300

/**
 * GET /api/advance/activity
 * Adelantos abiertos, cuentas y ahorro que los respaldó (ver `lib/advance/activity.ts`).
 * `null` si el contrato configurado no tiene corte (p. ej. testnet).
 */
export async function GET() {
  try {
    return NextResponse.json({ activity: await advanceActivity() })
  } catch (e) {
    return errorResponse(e, 'advance/activity')
  }
}
