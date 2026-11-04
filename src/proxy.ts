import { NextResponse } from 'next/server'

/**
 * Rieles heredados (Bitso, Juno, Dynerox): apagados en producción.
 *
 * SEYF es full Stellar y estas rutas operan con las llaves del negocio sin
 * sesión de usuario: cualquiera podría leer saldos, colocar órdenes o emitir
 * MXNB. El código se conserva para retomar la integración más adelante.
 *
 * Antes de poner SEYF_LEGACY_RAILS_ENABLED=true en producción, cada ruta debe
 * exigir sesión (`requireSession` / `requireDbAccess`): el interruptor solo
 * abre la puerta, no agrega autenticación.
 */
export function proxy() {
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.SEYF_LEGACY_RAILS_ENABLED === 'true'
  ) {
    return NextResponse.next()
  }
  return NextResponse.json(
    { error: { message: 'Not available in production' } },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  )
}

export const config = {
  matcher: [
    '/api/bitso/:path*',
    '/api/convert/:path*',
    '/api/dynerox/:path*',
    '/api/juno/:path*',
    '/api/treasury/:path*',
  ],
}
