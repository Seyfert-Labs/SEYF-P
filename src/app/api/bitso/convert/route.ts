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

    // Montos EJECUTADOS reales (netos de comisión), no la cotización. Mejor
    // esfuerzo: si Bitso aún no expone los trades o falla, el cliente usa el
    // monto cotizado como respaldo. `major` = activo, `minor` = MXN.
    let filledFrom: number | undefined;
    let filledTo: number | undefined;
    try {
      const trades = await bitsoRequest<
        Array<{ major: string; minor: string; fees_amount?: string; fees_currency?: string }>
      >("GET", `/api/v3/order_trades/${payload.oid}`, { signed: true });
      if (Array.isArray(trades) && trades.length) {
        const major = trades.reduce((s, t) => s + Math.abs(Number(t.major) || 0), 0);
        const minor = trades.reduce((s, t) => s + Math.abs(Number(t.minor) || 0), 0);
        const feeIn = (cur: string) =>
          trades.reduce(
            (s, t) => s + (t.fees_currency?.toLowerCase() === cur.toLowerCase() ? Math.abs(Number(t.fees_amount) || 0) : 0),
            0,
          );
        if (from === "MXN") {
          // Compras el activo gastando MXN: recibes `major` (menos comisión en el activo).
          filledFrom = minor;
          filledTo = major - feeIn(otherCode);
        } else {
          // Vendes el activo por MXN: recibes `minor` (menos comisión en MXN).
          filledFrom = major;
          filledTo = minor - feeIn("mxn");
        }
      }
    } catch {
      /* sin trades aún → el cliente usa el monto cotizado */
    }

    return Response.json({ ok: true, oid: payload.oid, book: asset.book, side, filledFrom, filledTo });
  } catch (e) {
    // Degradación honesta: si las llaves no tienen permiso/fondos de trading,
    // la cotización (tasas) sigue siendo real; solo falla la ejecución.
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "No se pudo ejecutar la orden en Bitso." },
      { status: 502 },
    );
  }
}
