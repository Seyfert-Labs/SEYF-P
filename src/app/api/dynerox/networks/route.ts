import { dyneroxRequest } from '@/lib/dynerox/client';
import { ok, fail } from '@/lib/dynerox/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/dynerox/networks — lista las redes activas en Dynerox.
export async function GET() {
  try {
    const { data } = await dyneroxRequest('GET', '/v1/public/networks');
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
