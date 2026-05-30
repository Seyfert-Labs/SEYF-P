import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// POST /api/juno/webhook — recibe eventos asíncronos de Juno/Bitso
// (depósitos SPEI confirmados, redenciones liquidadas, etc.).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-bitso-signature');
  const webhookSecret = process.env.JUNO_WEBHOOK_SECRET;

  if (webhookSecret && signature) {
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }
  }

  let event: unknown = null;
  try {
    event = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
  }

  // TODO: procesar el evento (actualizar saldos, marcar txn como COMPLETED, notificar al usuario).
  console.log('[juno:webhook] evento recibido', event);

  return NextResponse.json({ received: true, timestamp: new Date().toISOString() });
}
