import { placeConversionOrder, ConversionError } from "@/lib/bitso/orders";
import { withdrawMXNB } from "@/lib/juno/issue";
import { beginConversion, completeConversion, abortConversion } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/convert — conversión FX per-user orquestada del lado servidor.
// Consolida en una operación ATÓMICA e IDEMPOTENTE:
//   1. reserva idempotente en el ledger (por `key` del cliente),
//   2. orden de mercado en Bitso (pool del negocio),
//   3. (solo inverso divisa→MXN) emisión de MXNB a la wallet del usuario,
//   4. liquidación del ledger con los montos ejecutados reales.
// Un reintento con la misma `key` NO coloca una segunda orden.
//
// El sentido FORWARD (MXN→divisa) requiere que el usuario YA haya movido su
// MXNB a la tesorería on-chain (paso client-side, firmado por su smart wallet)
// ANTES de llamar aquí. Esta ruta cubre orden + ledger.
export async function POST(request: Request) {
  const body = (await request.json()) as {
    wallet?: string;
    address?: string;
    from?: string;
    to?: string;
    amount?: number;
    key?: string;
    quotedFrom?: number;
    quotedTo?: number;
  };
  const { wallet, address, from, to, amount, key, quotedFrom, quotedTo } = body;

  if (!wallet || !from || !to || !key || !Number(amount)) {
    return Response.json({ error: "Parámetros inválidos (wallet, from, to, amount, key)." }, { status: 400 });
  }
  if (from !== "MXN" && to !== "MXN") {
    return Response.json({ error: "Una de las divisas debe ser MXN (MXNB)." }, { status: 400 });
  }
  const inverse = to === "MXN";
  if (inverse && (!address || !/^0x[a-fA-F0-9]{40}$/.test(address))) {
    return Response.json({ error: "Se requiere la wallet del usuario para emitir MXNB." }, { status: 400 });
  }

  // 1. Reserva idempotente. Si la `key` ya existe, corta sin colocar otra orden.
  const reserve = await beginConversion(wallet, { id: key, from, to, kind: inverse ? "inverse" : "forward" });
  if (!reserve.created) {
    const ex = reserve.existing!;
    if (ex.status === "completed") {
      return Response.json({ ok: true, idempotent: true, id: ex.id, oid: ex.oid, filledFrom: ex.amountFrom, filledTo: ex.amountTo });
    }
    return Response.json({ ok: false, error: "Conversión en proceso, espera un momento." }, { status: 409 });
  }

  try {
    // 2. Orden de mercado en Bitso.
    const order = await placeConversionOrder(from, to, Number(amount));
    const filledFrom = order.filledFrom ?? Number(quotedFrom) ?? Number(amount);
    const filledToRaw = order.filledTo ?? Number(quotedTo) ?? 0;
    // El withdrawal de Juno acepta máx 2 decimales. En el inverso redondeamos
    // hacia abajo el MXNB a emitir (el polvo < 0.01 queda como reserva); en el
    // forward el destino es el ledger, que admite la precisión completa.
    const filledTo = inverse ? Math.floor(filledToRaw * 100) / 100 : filledToRaw;

    // 3. Inverso: emite MXNB a la wallet del usuario (idempotente por `key`).
    if (inverse) {
      try {
        // `key` ya es un UUID (Juno valida X-Idempotency-Key como UUID; un
        // prefijo como `conv-${key}` lo rechaza con "Request validation failed").
        await withdrawMXNB(address!, filledTo, key);
      } catch (e) {
        // Vendido en Bitso pero la emisión falló: NO debitamos el ledger (el
        // usuario conserva su saldo en divisa). El MXN queda en el pool y la
        // reconciliación detectará el sobrante. Liberamos la reserva.
        await abortConversion(key);
        return Response.json(
          { ok: false, error: `Orden ejecutada pero la emisión de MXNB falló (${e instanceof Error ? e.message : "error"}). Sin cargo a tu saldo.` },
          { status: 502 },
        );
      }
    }

    // 4. Liquida el ledger con los montos ejecutados reales.
    await completeConversion(key, { amountFrom: filledFrom, amountTo: filledTo, oid: order.oid });
    return Response.json({ ok: true, id: key, oid: order.oid, filledFrom, filledTo });
  } catch (e) {
    // La orden no se colocó (o falló antes de ejecutar): libera la reserva.
    await abortConversion(key);
    const status = e instanceof ConversionError ? e.status : 502;
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "No se pudo ejecutar la conversión." },
      { status },
    );
  }
}
