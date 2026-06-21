import crypto from 'crypto';
import { NextResponse } from 'next/server';
import type { DyneroxWebhookEvent } from '@/types/dynerox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/dynerox/webhook — recibe eventos asíncronos de Dynerox:
//   user.created · order.created · order.failed · identity.approved · identity.rejected
//
// Al crear un webhook, Dynerox devuelve un `secret`. El esquema de firma
// (header + algoritmo) NO está documentado en el OpenAPI: hay que confirmarlo.
// Mientras tanto, la verificación HMAC-SHA256 de abajo es un PLACEHOLDER:
// si DYNEROX_WEBHOOK_SECRET y la firma están presentes, valida; si no, deja
// pasar (registrando) para no bloquear las pruebas en stage.
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface DyneroxWebhookEnvelope {
  event?: DyneroxWebhookEvent | string;
  data?: unknown;
  [k: string]: unknown;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // TODO: confirmar el nombre real del header de firma con Dynerox.
  const signature =
    request.headers.get('x-dynerox-signature') || request.headers.get('x-signature');
  const secret = process.env.DYNEROX_WEBHOOK_SECRET;
  if (secret && signature && !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  let event: DyneroxWebhookEnvelope | null = null;
  try {
    event = rawBody ? (JSON.parse(rawBody) as DyneroxWebhookEnvelope) : null;
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
  }

  // Durante las pruebas: registrar para inspeccionar la forma real de los eventos.
  console.log('[dynerox:webhook]', event?.event, JSON.stringify(event ?? {}));

  switch (event?.event) {
    case 'order.created':
      // TODO: on-ramp confirmado -> reflejar cripto recibida en el wallet del usuario.
      break;
    case 'order.failed':
      // TODO: marcar la orden como fallida / notificar al usuario.
      break;
    case 'identity.approved':
    case 'identity.rejected':
      // TODO: sincronizar con el KYC propio (Etherfuse) si aplica.
      break;
    case 'user.created':
    default:
      break;
  }

  // Responder 200 rápido para que Dynerox no reintente.
  return NextResponse.json({ received: true });
}
