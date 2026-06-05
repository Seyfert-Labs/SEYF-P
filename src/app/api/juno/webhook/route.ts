import crypto from "crypto";
import { NextResponse } from "next/server";
import { withdrawMXNB } from "@/lib/juno/issue";
import { getWalletByClabe, addTransaction, addMonthlyUsage } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Extrae los campos relevantes del evento Juno (múltiples formatos posibles).
function parseDepositEvent(event: Record<string, unknown>): {
  eventId: string;
  clabe: string;
  amount: number;
} | null {
  // Juno envía el evento en distintas estructuras según la versión de la API.
  // Intentamos los formatos conocidos en orden.
  const data = (event.data ?? event.payload ?? event) as Record<string, unknown>;

  const clabe =
    (data.receiver_clabe as string) ??
    (data.clabe as string) ??
    (event.receiver_clabe as string) ??
    null;

  const rawAmount =
    data.amount ?? data.mxn_amount ?? event.amount ?? null;

  const amount = rawAmount != null ? Number(rawAmount) : NaN;

  const eventId =
    (event.id as string) ??
    (data.id as string) ??
    (data.transaction_id as string) ??
    crypto.randomUUID();

  if (!clabe || isNaN(amount) || amount <= 0) return null;

  return { eventId, clabe, amount };
}

// POST /api/juno/webhook — recibe eventos asíncronos de Juno/Bitso.
// Flujo SPEI: evento recibido → busca wallet por CLABE → emite MXNB on-chain.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-bitso-signature");
  const webhookSecret = process.env.JUNO_WEBHOOK_SECRET;

  if (webhookSecret && signature) {
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.warn("[juno:webhook] firma inválida");
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }
  }

  let event: Record<string, unknown>;
  try {
    event = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const eventType = (event.type ?? event.event_type ?? "") as string;
  console.log("[juno:webhook] evento recibido", eventType, JSON.stringify(event).slice(0, 300));

  // Solo procesar depósitos completados.
  const isDeposit =
    /auto_payment|deposit|spei/i.test(eventType) ||
    (event.data as Record<string, unknown>)?.transaction_type === "DEPOSIT";

  if (!isDeposit) {
    return NextResponse.json({ received: true, skipped: eventType });
  }

  const parsed = parseDepositEvent(event);
  if (!parsed) {
    console.warn("[juno:webhook] evento sin CLABE o monto válido", event);
    return NextResponse.json({ received: true, skipped: "no_clabe_or_amount" });
  }

  const { eventId, clabe, amount } = parsed;

  // Buscar la wallet del usuario dueña de esa CLABE.
  const wallet = await getWalletByClabe(clabe);
  if (!wallet) {
    console.warn("[juno:webhook] CLABE no encontrada en Supabase:", clabe);
    return NextResponse.json({ received: true, skipped: "clabe_not_found" });
  }

  console.log("[juno:webhook] emitiendo", amount, "MXNB →", wallet);

  // Emitir MXNB on-chain a la smart wallet del usuario.
  // El idempotencyKey (eventId) garantiza que Juno no emita dos veces
  // si el webhook llega duplicado.
  let txResult: { idempotencyKey?: string } = {};
  try {
    txResult = await withdrawMXNB(wallet, amount, eventId);
  } catch (err) {
    console.error("[juno:webhook] error al emitir MXNB:", err);
    // Devolvemos 200 para que Juno no reintente indefinidamente;
    // el error queda registrado en logs.
    await addTransaction(wallet, { kind: "deposit", amount, status: "failed" });
    return NextResponse.json({ received: true, error: "issuance_failed" });
  }

  // Registrar la transacción en Supabase.
  const idempotencyKey = txResult.idempotencyKey ?? eventId;
  await addTransaction(wallet, {
    kind: "deposit",
    amount,
    status: "completed",
    tx_hash: idempotencyKey,
  });

  // Actualizar límites mensuales.
  const period = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  await addMonthlyUsage(wallet, period, "deposit", amount);

  console.log("[juno:webhook] depósito procesado:", amount, "MXN →", wallet);
  return NextResponse.json({ received: true, wallet, amount });
}
