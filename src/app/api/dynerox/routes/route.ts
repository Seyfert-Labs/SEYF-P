import { dyneroxRequest } from '@/lib/dynerox/client';
import { ok, fail, badRequest } from '@/lib/dynerox/respond';
import type { DyneroxCreateInstruction } from '@/types/dynerox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// El "route"/instruction es el corazón de Dynerox: una orden direccional con
// un leg `from` y un leg `to`.
//
// On-ramp SPEI -> cripto (objetivo de esta rama):
//   from: { currency: { symbol: "mxn" }, network: { name: "spei" } }
//   to:   { currency: { symbol: "usdt" }, network: { name: <red> },
//           account: <wallet del usuario> }
// La respuesta trae route_id, status (pending_identity ->
// pending_authorization -> active), authorization_url, y se espera que el
// leg `from` incluya una CLABE de depósito. CONFIRMAR forma exacta en stage.

// GET /api/dynerox/routes?user_id=...&instruction_id=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const { data } = await dyneroxRequest('GET', '/v1/public/routes', {
      query: {
        user_id: searchParams.get('user_id') || undefined,
        instruction_id: searchParams.get('instruction_id') || undefined,
        page: searchParams.get('page') || undefined,
        limit: searchParams.get('limit') || undefined,
      },
    });
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}

// POST /api/dynerox/routes — crea una instrucción direccional.
export async function POST(request: Request) {
  let body: DyneroxCreateInstruction;
  try {
    body = (await request.json()) as DyneroxCreateInstruction;
  } catch {
    return badRequest('Cuerpo JSON inválido.');
  }
  if (!body?.from || !body?.to) {
    return badRequest('Se requieren los legs `from` y `to`.');
  }
  try {
    const { data } = await dyneroxRequest('POST', '/v1/public/routes', { body });
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
