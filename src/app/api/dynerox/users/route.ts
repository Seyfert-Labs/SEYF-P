import { dyneroxRequest } from '@/lib/dynerox/client';
import { ok, fail, badRequest } from '@/lib/dynerox/respond';
import type { DyneroxCreateUser } from '@/types/dynerox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/dynerox/users?user_id=...  ó  ?page=&limit=&search=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id')?.trim();
  try {
    if (userId) {
      const { data } = await dyneroxRequest('GET', `/v1/public/users/${userId}`);
      return ok(data);
    }
    const { data } = await dyneroxRequest('GET', '/v1/public/users', {
      query: {
        page: searchParams.get('page') || undefined,
        limit: searchParams.get('limit') || undefined,
        search: searchParams.get('search') || undefined,
      },
    });
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}

// POST /api/dynerox/users — crea un usuario en Dynerox.
// NOTA KYC: mantenemos el KYC propio (Etherfuse). Aún hay que confirmar si
// Dynerox fuerza su propio paso de identidad (status pending_identity +
// authorization_url) o si acepta identidad ya verificada externamente.
export async function POST(request: Request) {
  let body: DyneroxCreateUser;
  try {
    body = (await request.json()) as DyneroxCreateUser;
  } catch {
    return badRequest('Cuerpo JSON inválido.');
  }
  const missing = (['first_name', 'last_name', 'email', 'curp'] as const).filter(
    (k) => !body?.[k],
  );
  if (missing.length) return badRequest(`Faltan campos requeridos: ${missing.join(', ')}.`);

  try {
    const { data } = await dyneroxRequest('POST', '/v1/public/users', { body });
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
