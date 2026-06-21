import { NextResponse } from 'next/server';
import { dyneroxRequest, dyneroxConfigured, DYNEROX_BASE_URL } from '@/lib/dynerox/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/dynerox/probe
// Endpoint de diagnóstico (solo dev) para validar la integración con Dynerox
// en stage UNA VEZ que exista DYNEROX_API_KEY. Resuelve las 3 incógnitas:
//   1) ¿La key autentica? (GET /networks)
//   2) ¿Qué redes/monedas de destino hay activas? (GET /networks + /currencies)
//   3) Forma real del leg `from` / si hay CLABE de depósito para on-ramp
//      (esto último se confirma creando una ruta manualmente; ver README).
//
// Uso: npm run dev  ->  curl http://localhost:3000/api/dynerox/probe
async function probe() {
  const result: Record<string, unknown> = {
    base_url: DYNEROX_BASE_URL,
    configured: dyneroxConfigured(),
  };

  if (!dyneroxConfigured()) {
    result.hint = 'Define DYNEROX_API_KEY en .env (stage) y reinicia el dev server.';
    return result;
  }

  // 1) + 2) Redes activas
  try {
    const networks = await dyneroxRequest('GET', '/v1/public/networks');
    result.networks = networks.data;

    // Para cada red, intenta listar monedas (toma la primera con `name`).
    const list = (networks.data as { networks?: Array<{ name?: string }> })?.networks;
    const firstNet = Array.isArray(list) ? list.find((n) => n?.name)?.name : undefined;
    if (firstNet) {
      const currencies = await dyneroxRequest('GET', '/v1/public/currencies', {
        query: { network: firstNet },
      });
      result.currencies_sample = { network: firstNet, data: currencies.data };
    }
  } catch (e) {
    result.networks_error = e instanceof Error ? e.message : String(e);
  }

  return result;
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }
  try {
    return NextResponse.json(await probe());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
