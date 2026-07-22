import { NextResponse } from 'next/server';
import { dyneroxRequest } from '@/lib/dynerox/client';
import { ok, fail, badRequest } from '@/lib/dynerox/respond';
import type { DyneroxCreateWebhook, DyneroxWebhook, DyneroxWebhookEvent } from '@/types/dynerox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Administración de webhooks en Dynerox (alta/baja/listado).
//
// OJO — no confundir con `/api/dynerox/webhook` (singular), que es el RECEPTOR
// de eventos que Dynerox nos llama a nosotros. Este archivo es el panel de
// control: le dice a Dynerox a dónde mandar los eventos.
//
// Solo dev: `/api/dynerox/*` no lleva autenticación, así que exponer el alta y
// la baja de webhooks en producción dejaría que cualquiera redirija o borre
// nuestros eventos. Se administran desde local (o desde la referencia Scalar
// en https://api-stage.dynerox.com/docs/). Mismo criterio que `probe`.
function guard() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }
  return null;
}

const VALID_EVENTS: readonly DyneroxWebhookEvent[] = [
  'user.created',
  'route.created',
  'kyc.completed',
  'transfer.completed',
  'order.completed',
];

// GET /api/dynerox/webhooks — lista los webhooks registrados.
export async function GET() {
  const blocked = guard();
  if (blocked) return blocked;

  try {
    const { data } = await dyneroxRequest('GET', '/v1/public/webhooks');
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}

// POST /api/dynerox/webhooks — Body: { url, events: [...] }
//
// La respuesta trae `secret` (prefijo `whs_`) y es la ÚNICA vez que Dynerox lo
// devuelve: hay que copiarlo a `DYNEROX_WEBHOOK_SECRET` en ese momento. Si se
// pierde, toca borrar el webhook y crear otro.
export async function POST(request: Request) {
  const blocked = guard();
  if (blocked) return blocked;

  let body: DyneroxCreateWebhook;
  try {
    body = (await request.json()) as DyneroxCreateWebhook;
  } catch {
    return badRequest('Cuerpo JSON inválido.');
  }

  if (!body?.url) return badRequest('Falta `url` (endpoint público que recibirá los eventos).');
  if (!Array.isArray(body?.events) || body.events.length === 0) {
    return badRequest(`Falta \`events\`. Válidos: ${VALID_EVENTS.join(', ')}.`);
  }
  const unknown = body.events.filter((e) => !VALID_EVENTS.includes(e));
  if (unknown.length) {
    return badRequest(
      `Eventos no soportados: ${unknown.join(', ')}. Válidos: ${VALID_EVENTS.join(', ')}.`,
    );
  }

  try {
    const { data } = await dyneroxRequest<DyneroxWebhook>('POST', '/v1/public/webhooks', { body });
    return ok(data, {
      hint: 'Copia `secret` a DYNEROX_WEBHOOK_SECRET: Dynerox no lo vuelve a mostrar.',
    });
  } catch (e) {
    return fail(e);
  }
}

// DELETE /api/dynerox/webhooks?webhook_id=<uuid>
export async function DELETE(request: Request) {
  const blocked = guard();
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const webhookId = searchParams.get('webhook_id')?.trim();
  if (!webhookId) return badRequest('Falta el parámetro `webhook_id`.');

  try {
    const { data } = await dyneroxRequest('DELETE', `/v1/public/webhooks/${webhookId}`);
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
