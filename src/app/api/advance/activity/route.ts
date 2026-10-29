import { NextResponse } from 'next/server'
import { advanceActivity } from '@/lib/advance/activity'
import { errorResponse } from '@/lib/advance/http'

export const runtime = 'nodejs'
// Dinámica: con `force-static` se generaba en el build y, si el RPC tardaba más de
// 60 s, tumbaba el deploy. El caché de 5 min lo hace el CDN (s-maxage), así las
// visitas a la landing siguen sin llegar al RPC.
export const dynamic = 'force-dynamic'

const CACHE = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' }

/**
 * GET /api/advance/activity
 * Adelantos abiertos, cuentas y ahorro que los respaldó (ver `lib/advance/activity.ts`).
 * `null` si el contrato configurado no tiene corte (p. ej. testnet).
 */
export async function GET() {
  try {
    return NextResponse.json({ activity: await advanceActivity() }, { headers: CACHE })
  } catch (e) {
    return errorResponse(e, 'advance/activity')
  }
}
