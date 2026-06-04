import { placeConversionOrder, ConversionError } from "@/lib/bitso/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/bitso/convert — ejecuta SOLO la orden de mercado en Bitso (sin
// ledger ni liquidación on-chain). Se conserva para usos puntuales; el flujo
// per-user completo (orden + ledger idempotente + emisión MXNB) vive en
// /api/convert. Un lado debe ser MXN (≡ MXNB).
export async function POST(request: Request) {
  try {
    const { from, to, amount } = (await request.json()) as { from?: string; to?: string; amount?: number };
    const r = await placeConversionOrder(from ?? "", to ?? "", Number(amount));
    return Response.json({ ok: true, oid: r.oid, book: r.book, side: r.side, filledFrom: r.filledFrom, filledTo: r.filledTo });
  } catch (e) {
    const status = e instanceof ConversionError ? e.status : 502;
    // Degradación honesta: si las llaves no tienen permiso/fondos de trading,
    // la cotización (tasas) sigue siendo real; solo falla la ejecución.
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "No se pudo ejecutar la orden en Bitso." },
      { status },
    );
  }
}
