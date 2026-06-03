import { bitsoRequest } from "@/lib/bitso/client";
import { assetByCode } from "@/lib/bitso/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/bitso/convert — ejecuta una conversión real como orden de mercado
// en Bitso. Un lado debe ser MXN (≡ MXNB). Ej. MXN→USDT = buy usdt_mxn (minor=MXN).
export async function POST(request: Request) {
  try {
    const { from, to, amount } = (await request.json()) as { from?: string; to?: string; amount?: number };
    const n = Number(amount);
    if (!from || !to || !n || n <= 0) {
      return Response.json({ error: "Parámetros inválidos (from, to, amount)." }, { status: 400 });
    }
    if (from === to) return Response.json({ error: "Las divisas deben ser distintas." }, { status: 400 });
    if (from !== "MXN" && to !== "MXN") {
      return Response.json({ error: "Una de las divisas debe ser MXN (MXNB)." }, { status: 400 });
    }

    // El activo no-MXN define el book; el lado depende de la dirección.
    const otherCode = from === "MXN" ? to : from;
    const asset = assetByCode(otherCode);
    if (!asset?.book) {
      return Response.json({ error: `Bitso no ofrece un mercado para ${otherCode}.` }, { status: 400 });
    }

    // from=MXN → compras el activo gastando MXN (minor). from=activo → vendes (major).
    const side = from === "MXN" ? "buy" : "sell";
    const order: Record<string, string> = { book: asset.book, side, type: "market" };
    if (from === "MXN") order.minor = String(n);
    else order.major = String(n);

    const payload = await bitsoRequest<{ oid: string }>("POST", "/api/v3/orders", {
      body: order,
      signed: true,
    });
    return Response.json({ ok: true, oid: payload.oid, book: asset.book, side });
  } catch (e) {
    // Degradación honesta: si las llaves no tienen permiso/fondos de trading,
    // la cotización (tasas) sigue siendo real; solo falla la ejecución.
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "No se pudo ejecutar la orden en Bitso." },
      { status: 502 },
    );
  }
}
