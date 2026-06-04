import { bitsoRequest } from "./client";
import { assetByCode } from "./assets";

// ============================================================
// Helper compartido: ejecuta una conversión como orden de mercado en Bitso.
// Un lado debe ser MXN (≡ MXNB). El activo no-MXN define el `book`; el lado
// depende de la dirección: from=MXN → buy (gastas MXN, `minor`); from=activo →
// sell (vendes el activo, `major`). Devuelve los montos EJECUTADOS reales
// (netos de comisión) leídos de los trades por OID; si Bitso aún no los expone,
// `filled*` queda undefined y el llamador usa la cotización como respaldo.
// ============================================================

export interface ConversionResult {
  oid: string;
  book: string;
  side: "buy" | "sell";
  filledFrom?: number;
  filledTo?: number;
}

export class ConversionError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "ConversionError";
    this.status = status;
  }
}

export async function placeConversionOrder(
  from: string,
  to: string,
  amount: number,
): Promise<ConversionResult> {
  const n = Number(amount);
  if (!from || !to || !n || n <= 0) throw new ConversionError("Parámetros inválidos (from, to, amount).", 400);
  if (from === to) throw new ConversionError("Las divisas deben ser distintas.", 400);
  if (from !== "MXN" && to !== "MXN") throw new ConversionError("Una de las divisas debe ser MXN (MXNB).", 400);

  const otherCode = from === "MXN" ? to : from;
  const asset = assetByCode(otherCode);
  if (!asset?.book) throw new ConversionError(`Bitso no ofrece un mercado para ${otherCode}.`, 400);

  const side: "buy" | "sell" = from === "MXN" ? "buy" : "sell";
  const order: Record<string, string> = { book: asset.book, side, type: "market" };
  if (from === "MXN") order.minor = String(n);
  else order.major = String(n);

  const { oid } = await bitsoRequest<{ oid: string }>("POST", "/api/v3/orders", { body: order, signed: true });

  // Montos ejecutados reales por OID (mejor esfuerzo). `major` = activo, `minor` = MXN.
  let filledFrom: number | undefined;
  let filledTo: number | undefined;
  try {
    const trades = await bitsoRequest<
      Array<{ major: string; minor: string; fees_amount?: string; fees_currency?: string }>
    >("GET", `/api/v3/order_trades/${oid}`, { signed: true });
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
    /* sin trades aún → el llamador usa el monto cotizado */
  }

  return { oid, book: asset.book, side, filledFrom, filledTo };
}
