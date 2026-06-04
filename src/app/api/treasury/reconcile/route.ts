import { bitsoRequest } from "@/lib/bitso/client";
import { BITSO_ASSETS } from "@/lib/bitso/assets";
import { sumLedgerByAsset } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/treasury/reconcile — verifica el invariante del modelo pooled+ledger:
// para CADA activo (USDT, EUR, …):  Σ(saldo de todos los usuarios en el ledger)
// debe ser ≤ balance real del pool en Bitso. El sobrante (drift ≥ 0) es la
// reserva del negocio; un drift < 0 significa que el ledger promete más de lo
// que respalda el pool (fees no contabilizados, fill parcial, emisión fallida).
interface BitsoBalance { currency: string; available: string; total: string }

export async function GET() {
  try {
    const [poolPayload, ledger] = await Promise.all([
      bitsoRequest<{ balances: BitsoBalance[] }>("GET", "/api/v3/balance", { signed: true }),
      sumLedgerByAsset(),
    ]);

    // Balance real del pool por código de UI (Bitso usa minúsculas).
    const pool: Record<string, number> = {};
    for (const b of poolPayload.balances ?? []) {
      pool[b.currency.toUpperCase()] = Number(b.available) || 0;
    }

    // Activos no-MXN que soportamos en "Convertir".
    const assets = BITSO_ASSETS.filter((a) => a.code !== "MXN").map((a) => a.code);
    let healthy = true;
    const report = assets.map((code) => {
      const ledgerTotal = ledger[code] ?? 0;
      const poolBalance = pool[code] ?? 0;
      const drift = poolBalance - ledgerTotal; // reserva del negocio si ≥ 0
      const ok = drift >= -1e-6;
      if (!ok) healthy = false;
      return {
        asset: code,
        ledgerTotal: Number(ledgerTotal.toFixed(8)),
        poolBalance: Number(poolBalance.toFixed(8)),
        drift: Number(drift.toFixed(8)),
        ok,
      };
    });

    return Response.json({ ok: true, healthy, checkedAt: new Date().toISOString(), assets: report });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "No se pudo reconciliar." },
      { status: 502 },
    );
  }
}
