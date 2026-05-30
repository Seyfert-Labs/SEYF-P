import { NextResponse } from 'next/server';
import { JUNO_BASE_URL } from '@/lib/juno/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/juno/health — comprueba que la capa de integración está viva.
export function GET() {
  const configured = Boolean(process.env.BITSO_APIKEY && process.env.BITSO_SECRET_APIKEY);
  return NextResponse.json({
    success: true,
    message: 'Integración Juno/Bitso Business operativa',
    juno_base_url: JUNO_BASE_URL,
    credentials_configured: configured,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}
