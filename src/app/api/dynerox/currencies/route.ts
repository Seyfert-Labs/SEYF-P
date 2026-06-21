import { dyneroxRequest } from '@/lib/dynerox/client';
import { ok, fail, badRequest } from '@/lib/dynerox/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/dynerox/currencies?network=ethereum — monedas soportadas por red.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get('network')?.trim();
  const provider = searchParams.get('provider')?.trim() || undefined;
  if (!network) return badRequest('Falta el parámetro `network`.');
  try {
    const { data } = await dyneroxRequest('GET', '/v1/public/currencies', {
      query: { network, provider },
    });
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
