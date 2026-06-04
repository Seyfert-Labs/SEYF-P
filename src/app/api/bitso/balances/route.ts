import { bitsoRequest } from "@/lib/bitso/client";
import { BITSO_ASSETS } from "@/lib/bitso/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/bitso/balances — saldo real de la cuenta Bitso (firmado).
// Nota: en MVP las llaves son de la cuenta de negocio; el saldo es el de la
// cuenta Bitso completa, no por-usuario. Se usa para CONFIRMAR el disponible
// real; el desglose por-usuario se deriva localmente de las conversiones.
interface BitsoBalance {
  currency: string;
  available: string;
  locked: string;
  total: string;
}

export async function GET() {
  try {
    const payload = await bitsoRequest<{ balances: BitsoBalance[] }>("GET", "/api/v3/balance", {
      signed: true,
    });
    // Códigos de Bitso vienen en minúsculas (mxn, usdt, usd…). Los mapeamos
    // a los códigos de la UI y solo devolvemos los activos que soportamos.
    const supported = new Set(BITSO_ASSETS.map((a) => a.code.toLowerCase()));
    const balances: Record<string, { available: number; total: number }> = {};
    for (const b of payload.balances ?? []) {
      const code = b.currency.toLowerCase();
      if (!supported.has(code)) continue;
      balances[code.toUpperCase()] = {
        available: Number(b.available) || 0,
        total: Number(b.total) || 0,
      };
    }
    return Response.json({ ok: true, balances });
  } catch (e) {
    // Degradación honesta: si las llaves no tienen permiso de lectura de saldo,
    // el front cae al saldo derivado localmente de las conversiones.
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "No se pudo leer el saldo de Bitso." },
      { status: 502 },
    );
  }
}
